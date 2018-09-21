from .ove import Space

# Configuration for local testing
_local_ports = {
    'control': '8080',
    'maps': '8081',
    'images': '8082',
    'html': '8083',
    'videos': '8084',
    'networks': '8085',
    'charts': '8086',
    'imagetiles': '8087'
}

_local_size = {
    'width': 1440,
    'height': 808,
    'screen_rows': 3,
    'screen_cols': 3
}

# Configuration for Data Observatory and DO-Dev
_do_ports = {'control': '9080',
             'maps': '9081',
             'images': '9082',
             'html': '9083',
             'videos': '9084',
             'networks': '9085',
             'charts': '9086',
             'imagetiles': '9087'
             }

_dodev_size = {
    'height': 4320,
    'width': 15360,
    'screen_rows': 2,
    'screen_cols': 4
}

_do_size = {
    'height': 4320,
    'width': 30720,
    'screen_rows': 4,
    'screen_cols': 16
}

local_space = Space(ove_host="localhost", space_name="LocalNine", ports=_local_ports, geometry=_local_size)
dodev = Space(ove_host="gdo-appsdev.dsi.ic.ac.uk", space_name="DODev", ports=_do_ports, geometry=_dodev_size)
doprod = Space(ove_host="gdo-appsdev.dsi.ic.ac.uk", space_name="DOCluster", ports=_do_ports, geometry=_do_size)
