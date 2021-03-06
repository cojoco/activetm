import copy
import ctypes
import heapq
import numpy as np
import os
import random
import sys

from . import sampling
from . import wordindex
from . import ctypesutils
from .. import abstract

script_dir = os.path.dirname(os.path.abspath(__file__))
so_path = os.path.join(script_dir, 'csampling.so')
sampling_dll = ctypes.CDLL(so_path)

class CorpusData(ctypes.Structure):
    _fields_ = [
        ('numDocs', ctypes.c_int),
        ('docSizes', ctypes.POINTER(ctypes.c_int)),
        ('docWords', ctypes.POINTER(ctypes.POINTER(ctypes.c_int))),
        ('numResponses', ctypes.c_int),
        ('responseValues', ctypes.POINTER(ctypes.c_double))
    ]

class SamplerState(ctypes.Structure):
    _fields_ = [
        ('numTopics', ctypes.c_int),
        ('vocabSize', ctypes.c_int),
        ('alphas', ctypes.POINTER(ctypes.c_double)),
        ('hyperbeta', ctypes.c_double),
        ('eta', ctypes.POINTER(ctypes.c_double)),
        ('var', ctypes.c_double),
        ('corpusData', ctypes.POINTER(CorpusData)),
        ('topicAssignments', ctypes.POINTER(ctypes.POINTER(ctypes.c_int))),
        ('docTopicCounts', ctypes.POINTER(ctypes.POINTER(ctypes.c_int))),
        ('topicWordCounts', ctypes.POINTER(ctypes.POINTER(ctypes.c_int))),
        ('topicWordSum', ctypes.POINTER(ctypes.c_int))
    ]

sampling_sLDA = sampling_dll.sample_sLDA
sampling_sLDA.argtypes = (ctypes.POINTER(SamplerState), ctypes.c_int,
        ctypes.POINTER(ctypes.c_int))
sampling_sLDA.restype = ctypes.POINTER(ctypes.POINTER(SamplerState))
sampling_setSeed = sampling_dll.setSeed
sampling_setSeed.argtypes = (ctypes.c_ulonglong,)
getExpectedTopicCounts = sampling_dll.getExpectedTopicCounts
getExpectedTopicCounts.argtypes = (ctypes.c_int, ctypes.c_int,
        ctypes.POINTER(ctypes.POINTER(ctypes.POINTER(SamplerState))),
        ctypes.c_int, ctypes.POINTER(ctypes.c_int),
        ctypes.POINTER(ctypes.POINTER(ctypes.c_int)), ctypes.c_int,
        ctypes.POINTER(ctypes.c_int))
getExpectedTopicCounts.restype = ctypes.POINTER(ctypes.POINTER(ctypes.POINTER(ctypes.POINTER(
        ctypes.c_double))))
freeSavedStates = sampling_dll.freeSavedStates
freeSavedStates.argtypes = (ctypes.POINTER(ctypes.POINTER(SamplerState)),
        ctypes.c_int)
cPredict = sampling_dll.predict
cPredict.argtypes = (ctypes.c_int, ctypes.POINTER(ctypes.POINTER(SamplerState)),
        ctypes.c_int, ctypes.POINTER(ctypes.c_int), ctypes.c_int,
        ctypes.POINTER(ctypes.c_int))
cPredict.restype = ctypes.POINTER(ctypes.c_double)
freeDoubleArray = sampling_dll.freeDoubleArray
freeDoubleArray.argtypes = (ctypes.POINTER(ctypes.c_double),)
freeDoubleMatrix = sampling_dll.freeDoubleMatrix
freeDoubleMatrix.argtypes = (ctypes.POINTER(ctypes.POINTER(ctypes.c_double)),
        ctypes.c_int)
freeDoubleTensor = sampling_dll.freeDoubleTensor
freeDoubleTensor.argtypes = (ctypes.POINTER(ctypes.POINTER(ctypes.POINTER(ctypes.POINTER(
        ctypes.c_double)))), ctypes.c_int, ctypes.c_int, ctypes.c_int)

def set_seed(seed):
    sampling_setSeed(ctypes.c_ulonglong(seed))

class SamplingSLDA(abstract.AbstractModel):
    '''SamplingSLDA requires the following parameters:
        * numtopics
            the number of topics to look for
        * initalpha
            the initial value for the hyperparameter over the per-document topic
            distribution
        * inithyperbeta
            the initial value for the hyperparameter over the per topic
            word-type distribution
        * initvar
            the initial value for the variance parameter of the prediction
            variables
        * numtrainchains
            the number of sampling chains to use during training
        * numsamplespertrainchain
            the number of samples to keep per training chain
        * trainburn
            the number of sampling iterations to burn during training
        * trainlag
            the number of sampling iterations between samples kept during
            training
        * numsamplesperpredictchain
            the number of samples to keep per prediction chain; each sample
            saved during training will spawn a prediction chain
        * predictburn
            the number of sampling iterations to burn during prediction
        * predictlag
            the number of sampling iterations between samples kept during
            prediction
    '''
    def __init__(self, rng, numtopics, initalpha, inithyperbeta, initvar, numtrainchains,
            numsamplespertrainchain, trainburn, trainlag,
            numsamplesperpredictchain, predictburn, predictlag):
        self.rng = rng
        self.numtopics = numtopics
        self.alphas = (ctypes.c_double * numtopics)()
        for i in range(numtopics):
            self.alphas[i] = initalpha
        self.hyperbeta = ctypes.c_double(inithyperbeta)
        self.var = ctypes.c_double(initvar)
        self.numtrainchains = numtrainchains
        self.numsamplespertrainchain = numsamplespertrainchain
        self.trainburn = trainburn
        self.trainlag = trainlag
        self.numsamplesperpredictchain = numsamplesperpredictchain
        self.predictburn = predictburn
        self.predictlag = predictlag
        self.saved_statesc = (ctypes.POINTER(ctypes.POINTER(
                SamplerState)) * self.numtrainchains)()

        predictschedule = [self.predictlag] * self.numsamplesperpredictchain
        predictschedule[0] = self.predictburn
        self.predictschedarr = ctypesutils.convertFromIntList(predictschedule)

        # other instance variables initialized in train:
        #   self.trainingdoc_ids
        #   self.trainvectors
        #   self.wordindex
        #   self.prevlabeledcount

    def train(self, dataset, trainingdoc_ids, knownresp, continue_training=False):
        # trainingdoc_ids must be a list
        # knownresp must be a list such that its values correspond with trainingdoc_ids
        self.trainingdoc_ids = copy.deepcopy(trainingdoc_ids)
        responseValues = ctypesutils.convertFromDoubleList(knownresp)
        sizesList = []
        for doc_id in self.trainingdoc_ids:
            sizesList.append(len(dataset.doc_tokens(doc_id)))
        docSizes = ctypesutils.convertFromIntList(sizesList)
        trainvectors, self.wordindex = \
                wordindex.vectorize_training(self.trainingdoc_ids, dataset)
        vocabSize = ctypes.c_int(self.wordindex.size())
        numVocabList = [self.wordindex.size()] * self.numtopics
        corpusData = CorpusData(
                len(self.trainingdoc_ids), docSizes, trainvectors,
                len(knownresp), ctypesutils.convertFromDoubleList(knownresp))
        loop_schedule = [self.trainlag] * self.numsamplespertrainchain

        for curchain in range(self.numtrainchains):
            topicassignments = sampling.init_topic_assignments(
                    self.trainingdoc_ids, dataset, self.rng, self.numtopics)
            eta = (ctypes.c_double * self.numtopics)()
            if continue_training:
                # fill back previous state of sampler
                final_state = self.numsamplespertrainchain - 1
                prev_assignments = self.saved_statesc[curchain][final_state].contents.topicAssignments
                for i in range(self.prevlabeledcount):
                    # assuming that the first self.prevlabeledcount elements of
                    # self.trainingdoc_ids are the same labeled documents trained
                    # on in the last training iteration
                    for j in range(len(dataset.doc_tokens(self.trainingdoc_ids[i]))):
                        topicassignments[i][j] = prev_assignments[i][j]
                for i in range(self.numtopics):
                    eta[i] = self.saved_statesc[curchain][final_state].contents.eta[i]
                self.var = self.saved_statesc[curchain][final_state].contents.var
                freeSavedStates(self.saved_statesc[curchain],
                        ctypes.c_int(self.numsamplespertrainchain))
            else:
                # need to set first loop to go through burn
                loop_schedule[0] = self.trainburn
                labelsmean = np.mean(knownresp)
                for i in range(self.numtopics):
                    eta[i] = ((float(i*2) - 1.0) / (float(self.numtopics) - 1.0)) \
                            + labelsmean
            doctopiccounts, topicwordcounts = \
                    sampling.count_topic_assignments(self.trainingdoc_ids, self.numtopics,
                            self.wordindex.size(), dataset, topicassignments,
                            self.wordindex)

            prepresums = np.array(ctypesutils.convertToListOfLists(topicwordcounts,
                        numVocabList))
            presums = np.sum(prepresums, axis=1)
            topicwordsum = ctypesutils.convertFromIntList(presums)
            samplerState = SamplerState(self.numtopics, self.wordindex.size(),
                    self.alphas, self.hyperbeta, eta, self.var,
                    ctypes.pointer(corpusData),
                    topicassignments, doctopiccounts, topicwordcounts,
                    topicwordsum)

            self.saved_statesc[curchain] = sampling_sLDA(samplerState, ctypes.c_int(self.numsamplespertrainchain),
                    ctypesutils.convertFromIntList(loop_schedule))
        self.prevlabeledcount = len(self.trainingdoc_ids)

    def predict(self, doc):
        resultsList = []
        docws = self.wordindex.vectorize_without_adding(doc)
        if len(docws) <= 0:
            return self.rng.random()
        docsize = len(docws)
        docwsarr = ctypesutils.convertFromIntList(docws)
        for curchain in range(self.numtrainchains):
            cResults = cPredict(ctypes.c_int(self.numsamplespertrainchain),
                    self.saved_statesc[curchain], ctypes.c_int(docsize),
                    docwsarr,
                    self.numsamplesperpredictchain,
                    self.predictschedarr)
            # get a query by committee result
            resultsList.append(np.mean(ctypesutils.convertToList(cResults,
                    self.numsamplespertrainchain *
                    self.numsamplesperpredictchain)))
            freeDoubleArray(cResults)
        return np.mean(resultsList)

    def cleanup(self):
        count = ctypes.c_int(self.numsamplespertrainchain)
        for i in range(self.numtrainchains):
            freeSavedStates(self.saved_statesc[i], count)
    
    # this method was too slow when done with individual documents
    def _get_expected_topic_counts(self, dataset, doc_ids):
        knownwords = (ctypes.POINTER(ctypes.c_int) * len(doc_ids))()
        docSizes = []
        for i, c in enumerate(doc_ids):
            curDoc = self.wordindex.vectorize_without_adding(dataset.doc_tokens(c))
            docSizes.append(len(curDoc))
            knownwords[i] = ctypesutils.convertFromIntList(curDoc)
        expectedTopicCounts = getExpectedTopicCounts(self.numtrainchains,
                self.numsamplespertrainchain, self.saved_statesc,
                ctypes.c_int(len(doc_ids)), ctypesutils.convertFromIntList(docSizes),
                knownwords, self.numsamplesperpredictchain, self.predictschedarr)
        result = []
        for d in range(len(doc_ids)):
            result.append([])
            for i in range(self.numtrainchains):
                result[d].append([])
                for j in range(self.numsamplespertrainchain):
                    result[d][i].append(ctypesutils.convertToList(
                            expectedTopicCounts[d][i][j], self.numtopics))
        freeDoubleTensor(expectedTopicCounts, ctypes.c_int(len(doc_ids)),
                ctypes.c_int(self.numtrainchains), ctypes.c_int(self.numsamplespertrainchain))
        return result

    def _get_topic_distribution(self, topic, chain_num, state_num):
        result = np.array(ctypesutils.convertToList(
                self.saved_statesc[chain_num][state_num].contents.topicWordCounts[topic],
                self.wordindex.size()))
        return result / np.sum(result)

    def get_top_topics(self, dataset, doc_ids):
        result = np.zeros((len(doc_ids), self.wordindex.size()))
        expectedTopicCounts = self._get_expected_topic_counts(dataset, doc_ids)
        for d in range(len(doc_ids)):
            pq = []
            for i in range(self.numtrainchains):
                for j in range(self.numsamplespertrainchain):
                    highest = 0.0
                    highestTopic = -1
                    for k, val in enumerate(expectedTopicCounts[d][i][j]):
                        if val > highest:
                            highest = val
                            highestTopic = k
                    if highestTopic == -1:
                        highestTopic = rng.randint(0, self.numtopics-1)
                        highest = rng.random()
                    # we want the highest value out first, but heapq pops smallest first
                    heapq.heappush(pq, (-highest, highestTopic, i, j))
            (_, highestTopic, i, j) = heapq.heappop(pq)
            result[d,:] = self._get_topic_distribution(highestTopic, i, j)
        return result

