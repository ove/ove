import http.server
import socketserver
import _thread
import uuid
import matplotlib
from shutil import copyfile
import os
import socket


class Server:
    def __init__(self, server_address="", ove_address="localhost:9080", ove_environment="", tmp_dir="./tmp"):

        if not server_address:
            server_address = get_ip_address() + ":" + "8000"
        self.server_address = server_address

        if tmp_dir.startswith('./'):
            tmp_dir = os.path.join(os.getcwd(), tmp_dir)

        self.tmp_dir = tmp_dir
        if not os.path.exists(tmp_dir):
            print("Directory %s did not exist so was created" % tmp_dir)
            os.makedirs(tmp_dir)

        if not ove_address.startswith("http"):
            ove_address = "http://" + ove_address
        self.ove_address = ove_address

        self.ove_environment = ove_environment

        self.server = False
        self.old_cwd = os.getcwd()

    def __start_server__(self):
        os.chdir(self.tmp_dir)
        self.server.serve_forever()

    def start_server(self):
        print("starting server")
        (host, ip) = self.server_address.split(':')
        address = (host, int(ip))

        self.server = socketserver.TCPServer(address, http.server.SimpleHTTPRequestHandler)
        _thread.start_new_thread(self.__start_server__, ())

    def stop_server(self, delete_files=False):
        if not self.server:
            return

        self.server.shutdown()
        self.server.socket.close()

        if delete_files:
            print("Deleting contents of temporary directory", os.getcwd())
            for f in os.listdir(os.getcwd()):
                os.remove(f)

        os.chdir(self.old_cwd)

    def share_image(self, image):
        uid = str(uuid.uuid1())

        if os.path.exists(image):
            ext = os.path.splitext(os.path.basename(image))[-1]
            new_file_name = uid + ext
            copyfile(image, os.path.join(self.tmp_dir, new_file_name))
            return self.build_url(new_file_name)
        else:
            print("File %s does not exist" % image)
            return ""

    def share_matplotlib(self, plot):
        uid = str(uuid.uuid1())

        if isinstance(plot, matplotlib.figure.Figure):
            file_name = uid + '.png'
            plot.savefig(os.path.join(self.tmp_dir, file_name), bbox_inches='tight')  # alternative is png
            return self.build_url(file_name)
        else:
            print("Expected a matplotlib.figure.Figure, but received a %s (%s)" % (type(plot), plot))
            return ""

    def build_url(self, uid):
        if not self.server_address.startswith("http"):
            return "http://%s/%s" % (self.server_address, uid)
        else:
            return "%s/%s" % (self.server_address, uid)


def get_ip_address():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.connect(("8.8.8.8", 80))
    return s.getsockname()[0]
