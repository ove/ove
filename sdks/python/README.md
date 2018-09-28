# Python client library for the OVE API

This package provides a Python interface to the [Open Visualization Environment (OVE)](https://github.com/dsi-icl/ove) developed at the Imperial College [Data Science Institute](http://www.imperial.ac.uk/data-science/) for use with the [Data Observatory](https://github.com/dsi-icl/ove).

## Installation

Download and install with setup.py:

    cd ove/sdks/python
    setup.py install

## Example Usage

**Note:** The space is automatically put into offline mode which allows you to design your space without pushing changes 
live into the DO environment. If you wish to interact with the space directly you can **enable online mode** after import.

````python
from ove import save_file
from ove.config import dodev as space
# alternatively the doprod can be imported for the production environment
# from ove.config import doprod as space

# enable live mode if you wish to interact with the space directly
# space.enable_online_mode()

space.delete_sections()

video = space.add_section(w=2880, h=1616, x=720, y=404, app_type='videos')
video.set_url('https://www.youtube.com/watch?v=QJo-VFs1X5c')

# Wait for the video to buffer before calling the following command:
space.videos.play()

html = space.add_section(w=2880, h=1616, x=720, y=404, app_type='html')
html.set_url("http://metafilter.com")

image = space.add_section(w=5000, h=3000, x=7200, y=1000, app_type='images')
image.set_url("https://farm4.staticflickr.com/3107/2431422903_632ce51b56_o_d.jpg", "shelley")

map1 = space.add_section(w=5000, h=3000, x=10200, y=800, app_type='maps')
map1.set_position(latitude=0, longitude=0, zoom=5)

network = space.add_section(w=5000, h=3000, x=10200, y=800, app_type='networks')
network.set_data(json_url="https://raw.githubusercontent.com/dsi-icl/ove/master/packages/ove-app-graphs/src/data/sample.json")

chart = space.add_section_by_grid(w=1, h=1, r=0, c=0, app_type="charts")

chart.set_specification(spec_url="https://raw.githubusercontent.com/vega/vega/master/docs/examples/bar-chart.vg.json", options={"width": 900-35, "height": 900-35})

# the state of the space can be saved automatically with the save state file util function
save_file(json_state=space.to_json(title="Title of the presentation"), filename="my_state.json")

````

Videos can also be controlled independently:

```python
from ove.config import dodev as space

space.delete_sections()

video = space.add_section(w=2880, h=1616, x=720, y=404, app_type='videos')
video.set_url('https://www.youtube.com/watch?v=QJo-VFs1X5c')


video2 = space.add_section_by_grid(r=1, c=1, w=1, h=1, app_type='videos')
video2.set_url("https://www.youtube.com/watch?v=XY3NP4JHXZ4")


video.play()
video2.play()
video.pause()
video2.pause()

```

``ove-python`` also includes a local web-server that can be used to host images.

````python
import matplotlib.pyplot as plt

from ove.server import Server

from ove.config import dodev as space

s = Server()
s.start_server()

a = plt.figure()
plt.plot([1, 2, 3], [4, 5, 6])


# share_matplotlib() exports a plot object to PNG, and returns the url where can be accessed
url = s.share_matplotlib(a)
image = space.add_section_by_grid(w=1, h=1, r=2, c=2, app_type='images')
image.set_url(url)

````

Testing both DODev left and DODev right:

````python
from ove.config import dodev as space

space.delete_sections()

space.set_grid(space.geometry["screen_rows"], space.geometry["screen_cols"])

html = space.add_section_by_grid(w=2, h=2, r=0, c=0, app_type='html')
html.set_url("http://metafilter.com")

html2 = space.add_section_by_grid(w=2, h=2, r=0, c=4, app_type='html')
html2.set_url("http://ask.metafilter.com")
````