#! /usr/bin/ENV python3
"""Runs the Metadata Map"""

import flask
import os
import uuid
import threading
import pickle
import random
import sys

sys.path.append('/local/cojoco/metadataMap')

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


@APP.route('/oned')
def serve_ui():
    """Serves the Metadata Map one dimensional case UI"""
    return flask.send_from_directory('static', 'onedimension.html')


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
    # If uid is not in MODELS, it means the server restarted and we may
    #   need to retrain the model if it was trained before the restart
    with LOCK:
        if uid not in MODELS:
            MODELS[uid] = build_model()
            restarted = True
        num_labeled_ids = len(USER_DICT[uid]['labeled_doc_ids'])
        # Train at 20, 30, 40, 50... documents labeled
        if (num_labeled_ids >= START_TRAINING and
        (restarted or num_labeled_ids % TRAINING_INCREMENT == 0)):
            USER_DICT[uid]['training_complete'] = False
            labeled_doc_ids = []
            known_labels = []
            for doc_id, label in USER_DICT[uid]['docs_with_labels'].items():
                labeled_doc_ids.append(doc_id)
                known_labels.append(label)
            MODELS[uid].train(DATASET, labeled_doc_ids, known_labels, True)
            USER_DICT[uid]['training_complete'] = True


@APP.route('/uuid')
def get_uid():
    """Sends a UUID to the client"""
    uid = str(uuid.uuid4())
    data = {'id': uid}
    # Create a model here
    MODELS[uid] = build_model()
    with LOCK:
        USER_DICT[uid] = {
            'current_doc': -1,
            # This is a doc_number to label mapping
            'docs_with_labels': {},
            'labeled_doc_ids': [],
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
            if doc_number in USER_DICT[uid]['labeled_doc_ids']:
                return flask.jsonify(user_id=uid)
            USER_DICT[uid]['docs_with_labels'][doc_number] = label
            USER_DICT[uid]['labeled_doc_ids'].append(doc_number)
            USER_DICT[uid]['unlabeled_doc_ids'].remove(doc_number)
    save_state()
    return flask.jsonify(user_id=uid)


@APP.route('/getdoc')
def get_doc():
    """Gets the next document for this user"""
    uid = str(flask.request.headers.get('uuid'))
    doc_number = -1
    document = ''
    predicted_label = BASE_LABEL
    uncertainty = BASE_UNCERTAINTY
    if uid not in MODELS:
        train_model(uid)
    with LOCK:
        if uid in USER_DICT:
            # do what we need to get the right document for this user
            labeled_doc_ids = USER_DICT[uid]['labeled_doc_ids']
            unlabeled_doc_ids = USER_DICT[uid]['unlabeled_doc_ids']
            candidates = select.reservoir(unlabeled_doc_ids, RNG, CAND_SIZE)
            doc_number = SELECT_METHOD(DATASET, labeled_doc_ids, candidates,
                        MODELS[uid], RNG, LABEL_INCREMENT)[0] 
            document = DATASET.doc_metadata(doc_number, 'text')
            USER_DICT[uid]['current_doc'] = doc_number
            if (len(labeled_doc_ids) >= START_TRAINING and
            USER_DICT[uid]['training_complete'] is True):
                doc = DATASET.doc_tokens(doc_number)
                predicted_label = MODELS[uid].predict(doc)
                uncertainty = MODELS[uid].get_uncertainty(doc)
    save_state()
    return flask.jsonify(document=document, doc_number=doc_number,
                         predicted_label=predicted_label,
                         uncertainty=uncertainty)


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
    predicted_label = BASE_LABEL
    uncertainty = BASE_UNCERTAINTY
    if uid not in MODELS:
        train_model(uid)
    with LOCK:
        labeled_doc_ids = USER_DICT[uid]['labeled_doc_ids']
        if len(labeled_doc_ids) >= START_TRAINING:
            doc = DATASET.doc_tokens(doc_number)
            predicted_label = MODELS[uid].predict(doc)
            uncertainty = MODELS[uid].get_uncertainty(doc)
    return flask.jsonify(document=document, predicted_label=predicted_label,
                         uncertainty=uncertainty)


if __name__ == '__main__':
    APP.run(debug=True,
            host='0.0.0.0',
            port=3000)
