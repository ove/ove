import json
from six import string_types


def save_file(json_state, filename):
    json_state = json_state if isinstance(json_state, string_types) else json.dumps(json_state)
    with open(filename, mode="w+") as out:
        out.write(json_state)


def load_file(filename):
    with open(filename, mode="r+") as fin:
        return json.loads(fin.read())
