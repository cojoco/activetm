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
        print("Last state: " + str(state))
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
    print(DATASET)
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
    settings['model'] = 'ridge_anchor'
    settings['numtopics'] = 20
    settings['numtrain'] = 1
    return models.build(RNG, settings)


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
            'unlabeled_doc_ids': list(ALL_DOC_IDS)
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
            USER_DICT[uid]['docs_with_labels'][doc_number] = label
            USER_DICT[uid]['labeled_doc_ids'].append(doc_number)
            USER_DICT[uid]['unlabeled_doc_ids'].remove(doc_number)
            num_labeled_ids = len(USER_DICT[uid]['labeled_doc_ids'])
            # Train at 20, 30, 40, 50... documents labeled
            if num_labeled_ids >= 20 and num_labeled_ids % 10 == 0:
                labeled_doc_ids = []
                known_labels = []
                for doc_id, label in USER_DICT[uid]['docs_with_labels'].items():
                    labeled_doc_ids.append(doc_id)
                    known_labels.append(label)
                MODELS[uid].train(DATASET, labeled_doc_ids, known_labels, True)
    save_state()
    return flask.jsonify(user_id=uid)


@APP.route('/getdoc')
def get_doc():
    """Gets the next document for this user"""
    uid = str(flask.request.headers.get('uuid'))
    print(uid)
    doc_number = -1
    document = ''
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
            print("doc_number:", doc_number)
    save_state()
    return flask.jsonify(document=document, doc_number=doc_number)

@APP.route('/olddoc')
def old_doc():
    """Gets old document text for a user if they reconnect"""
    uid = str(flask.request.headers.get('uuid'))
    doc_number = int(flask.request.headers.get('doc_number'))
    document = DATASET.doc_metadata(doc_number, 'text')
    return flask.jsonify(document=document)


if __name__ == '__main__':
    APP.run(debug=True,
            host='0.0.0.0',
            port=3000)
