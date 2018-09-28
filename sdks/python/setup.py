#!/usr/bin/env python

from distutils.core import setup

setup(name='ove',
      version='0.1',
      description='Python client library for the the Open Visualisation Environment (OVE) API',
      author='James Scott-Brown',
      author_email='j.scott-brown@imperial.ac.uk',
      url='https://github.com/dsi-icl/ove',
      packages=['ove'], requires=['requests', 'matplotlib', 'six'])
