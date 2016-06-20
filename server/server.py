"""Runs a user interface for the interactive anchor words algorithm"""

import flask
import os
import uuid
import threading
import pickle
import random

APP = flask.Flask(__name__, static_url_path='')

RNG = random.Random()


@APP.route('/')
def serve_landing_page():
    """Serves the landing page for the Metadata Map UI"""
    return flask.send_from_directory('static', 'index.html')


@APP.route('/oned')
def serve_ui():
    """Serves the Metadata Map one dimensional case UI"""
    return flask.send_from_directory('static', 'onedimension.html')


@APP.route('/uuid')
def get_uid():
    """Sends a UUID to the client"""
    uid = uuid.uuid4()
    data = {'id': uid}
    return flask.jsonify(data)


if __name__ == '__main__':
    APP.run(debug=True,
            host='0.0.0.0',
            port=3000)
