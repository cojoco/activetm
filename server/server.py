#! /usr/bin/ENV python3
"""Runs the Metadata Map"""

import flask
import os
import uuid
import threading
import pickle
import random

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


###############################################################################
# Everything in this block needs to be run at server startup
# USER_DICT holds information for individual users
USER_DICT = get_user_dict_on_start()
LOCK = threading.Lock()
RNG = random.Random()
###############################################################################


def save_state():
    """Saves the state of the server to a pickle file"""
    last_state = {}
    last_state['USER_DICT'] = USER_DICT
    print(USER_DICT)
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


@APP.route('/uuid')
def get_uid():
    """Sends a UUID to the client"""
    uid = uuid.uuid4()
    data = {'id': uid}
    with LOCK:
        USER_DICT[str(uid)] = {
            'current_doc': -1,
            # This is a doc_number to label mapping
            'docs_with_labels': {}
        }
        save_state()
    return flask.jsonify(data)


@APP.route('/labeldoc', methods=['POST'])
def label_doc():
    """Receives the label for the previously sent document"""
    user_id = flask.request.headers.get('uuid')
    doc_number = flask.request.values.get('doc_number')
    label = flask.request.values.get('label')
    with LOCK:
        if user_id in USER_DICT:
            USER_DICT[str(user_id)]['current_doc'] = -1
            USER_DICT[str(user_id)]['docs_with_labels'][doc_number] = label
    print("doc_number: ", doc_number, " label: ", label)
    return flask.jsonify(user_id=user_id)


@APP.route('/getdoc')
def get_doc():
    """Gets the next document for this user"""
    user_id = flask.request.headers.get('uuid')
    doc_number = -1
    document = ''
    with LOCK:
        if user_id in USER_DICT:
            print("user_id in USER_DICT")
            # do what we need to get the right document for this user
            doc_number = RNG.randint(0, 10)
            document = 'document ' + str(doc_number)
    return flask.jsonify(document=document, doc_number=doc_number)


if __name__ == '__main__':
    APP.run(debug=True,
            host='0.0.0.0',
            port=3000)
