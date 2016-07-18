#! /usr/bin/ENV python3
"""Runs the Metadata Map"""

import flask
import os
import uuid
import threading
import pickle
import random
import sys

# This is ugly/dirty/hackish... Fix it if you like.
# You could probably just install activetm in your user library.
sys.path.append(os.path.join(os.path.dirname(os.path.realpath(__file__)), os.pardir))

from activetm.active import evaluate
from activetm.active import select
from activetm import models
from activetm import utils

APP = flask.Flask(__name__, static_url_path='')

def get_user_dict_on_start():
    """Loads user data"""
    # This maintains state if the server crashes
    try:
        last_state = open('last_state.pickle', 'rb')
    except IOError:
        print('No last_state.pickle file, assuming no previous state')
    else:
        state = pickle.load(last_state)
        print('last_state.pickle file loaded')
        last_state.close()
        return state['USER_DICT']
    # but if the server is starting fresh, so does the user data
    return {}


def get_dataset():
    """Gets the dataset from a pickle file in the local directory"""
    with open('dataset.pickle', 'rb') as in_file:
        dataset = pickle.load(in_file)
        return dataset


###############################################################################
# USER_DICT holds information for individual users
USER_DICT = get_user_dict_on_start()
# MODELS holds the model for each user
MODELS = {}
SELECT_METHOD = select.factory['random']
CAND_SIZE = 500
LABEL_INCREMENT = 1

# Start training after START_TRAINING labeled documents
START_TRAINING = 20
# Train every TRAINING_INCREMENT labeled documents after START_TRAINING
TRAINING_INCREMENT = 10

# Label and uncertainty if we don't have a trained model
BASE_LABEL = 0.5
BASE_UNCERTAINTY = 0.5

LOCK = threading.Lock()
RNG = random.Random()
DATASET = get_dataset()
ALL_DOC_IDS = [doc for doc in range(DATASET.num_docs)]
###############################################################################


def save_state():
    """Saves the state of the server to a pickle file"""
    last_state = {}
    last_state['USER_DICT'] = USER_DICT
    pickle.dump(last_state, open('last_state.pickle', 'wb'))


@APP.route('/')
def serve_landing_page():
    """Serves the landing page for the Metadata Map UI"""
    return flask.send_from_directory('static', 'index.html')


@APP.route('/end')
def serve_end():
    """Serves the end page, which gets rid of cookies"""
    return flask.send_from_directory('static', 'end.html')


@APP.route('/removeuser')
def remove_user():
    """Removes a user, called when a user goes to end.html"""
    uid = str(flask.request.headers.get('uuid'))
    if uid in USER_DICT:
        del USER_DICT[uid]
    return flask.jsonify({})


def build_model():
    """Builds a model for a user"""
    settings = {}
    settings['model'] = 'semi_ridge_anchor'
    settings['numtopics'] = 20
    settings['numtrain'] = 1
    return models.build(RNG, settings)


def train_model(uid):
    restarted = False
    with LOCK:
        # If uid is not in MODELS, it means the server restarted and we may
        #   need to retrain the model if it was trained before the restart
        if uid not in MODELS:
            MODELS[uid] = (build_model(), build_model())
            restarted = True
        num_labeled_ids = len(USER_DICT[uid]['docs_with_labels'])
        # Train at 20, 30, 40, 50... documents labeled
        if (num_labeled_ids >= START_TRAINING and
        (restarted or num_labeled_ids % TRAINING_INCREMENT == 0)):
            USER_DICT[uid]['training_complete'] = False
            labeled_doc_ids = []
            labels_one = []
            labels_two = []
            for doc_id, label in USER_DICT[uid]['docs_with_labels'].items():
                labeled_doc_ids.append(doc_id)
                # Labels are tuples, one value for horiz and one for vert
                labels_one.append(label[0])
                labels_two.append(label[1])
            MODELS[uid][0].train(DATASET, labeled_doc_ids, labels_one, True)
            MODELS[uid][1].train(DATASET, labeled_doc_ids, labels_two, True)
            USER_DICT[uid]['training_complete'] = True


@APP.route('/uuid')
def get_uid():
    """Sends a UUID to the client"""
    uid = str(uuid.uuid4())
    data = {'id': uid}
    # Create a model here
    MODELS[uid] = (build_model(), build_model())
    with LOCK:
        USER_DICT[uid] = {
            'current_doc': -1,
            # This is a doc_number to label mapping
            'docs_with_labels': {},
            'unlabeled_doc_ids': list(ALL_DOC_IDS),
            'training_complete': False
        }
        save_state()
    return flask.jsonify(data)


@APP.route('/labeldoc', methods=['POST'])
def label_doc():
    """Receives the label for the previously sent document"""
    uid = str(flask.request.headers.get('uuid'))
    doc_number = int(flask.request.values.get('doc_number'))
    label = float(flask.request.values.get('label'))
    with LOCK:
        if uid in USER_DICT:
            # If this endpoint was hit multiple times (say while the model was
            #   training), then we want to only act on the first request
            if doc_number in USER_DICT[uid]['docs_with_labels'].keys():
                return flask.jsonify(user_id=uid)
            USER_DICT[uid]['docs_with_labels'][doc_number] = label
            USER_DICT[uid]['unlabeled_doc_ids'].remove(doc_number)
    save_state()
    return flask.jsonify(user_id=uid)


@APP.route('/getdoc')
def get_doc():
    """Gets the next document for this user"""
    uid = str(flask.request.headers.get('uuid'))
    doc_number = -1
    document = ''
    predicted_label_x = BASE_LABEL
    uncertainty_x = BASE_UNCERTAINTY
    predicted_label_y = BASE_LABEL
    uncertainty_y = BASE_UNCERTAINTY
    if uid not in MODELS:
        train_model(uid)
    with LOCK:
        if uid in USER_DICT:
            # do what we need to get the right document for this user
            docs_with_labels = USER_DICT[uid]['docs_with_labels']
            unlabeled_doc_ids = USER_DICT[uid]['unlabeled_doc_ids']
            cand_set = select.reservoir(unlabeled_doc_ids, RNG, CAND_SIZE)
            # We are currently choosing based on what model 1 wants
            # TODO: Use both models' output to choose the next doc
            doc_number = SELECT_METHOD(DATASET, docs_with_labels.keys(),
                        cand_set, MODELS[uid][0], RNG, LABEL_INCREMENT)[0] 
            document = DATASET.doc_metadata(doc_number, 'text')
            USER_DICT[uid]['current_doc'] = doc_number
            if (len(docs_with_labels) >= START_TRAINING and
            USER_DICT[uid]['training_complete'] is True):
                doc = DATASET.doc_tokens(doc_number)
                predicted_label_x = MODELS[uid][0].predict(doc)
                uncertainty_x = MODELS[uid][0].get_uncertainty(doc)
                predicted_label_y = MODELS[uid][1].predict(doc)
                uncertainty_y = MODELS[uid][1].get_uncertainty(doc)
    save_state()
    return flask.jsonify(document=document, doc_number=doc_number,
                         predicted_label_x=predicted_label_x,
                         uncertainty_x=uncertainty_x,
                         predicted_label_y=predicted_label_y,
                         uncertainty_y=uncertainty_y)


@APP.route('/train')
def train_endpoint():
    uid = str(flask.request.headers.get('uuid'))
    if uid in USER_DICT:
        train_model(uid)
    return flask.jsonify({})


@APP.route('/olddoc')
def old_doc():
    """Gets old document text for a user if they reconnect"""
    uid = str(flask.request.headers.get('uuid'))
    doc_number = int(flask.request.headers.get('doc_number'))
    document = DATASET.doc_metadata(doc_number, 'text')
    predicted_label_x = BASE_LABEL
    uncertainty_x = BASE_UNCERTAINTY
    predicted_label_y = BASE_LABEL
    uncertainty_y = BASE_UNCERTAINTY
    if uid not in MODELS:
        train_model(uid)
    with LOCK:
        if len(USER_DICT[uid]['docs_with_labels']) >= START_TRAINING:
            doc = DATASET.doc_tokens(doc_number)
            predicted_label_x = MODELS[uid][0].predict(doc)
            uncertainty_x = MODELS[uid][0].get_uncertainty(doc)
            predicted_label_y = MODELS[uid][1].predict(doc)
            uncertainty_y = MODELS[uid][1].get_uncertainty(doc)
    return flask.jsonify(document=document, doc_number=doc_number,
                         predicted_label_x=predicted_label_x,
                         uncertainty_x=uncertainty_x,
                         predicted_label_y=predicted_label_y,
                         uncertainty_y=uncertainty_y)


if __name__ == '__main__':
    APP.run(debug=True,
            host='0.0.0.0',
            port=3000)
