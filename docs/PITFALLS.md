# Potential pitfalls

There are several potential pitfalls that you should be aware of when developing visualisation applications and content that will be displayed using OVE. Larger displays (in either physical dimensions or resolution) present more challenges, and some of these pitfalls are less of a concern for a smaller OVE installation.

## Technical considerations

**Deterministic layout and rendering**. If a section spans multiple clients, you should ensure that each client renders its part of the section in a way that is consistent with the other clients. For example, if a word-cloud is drawn using a random algorithm that is performed independently for each section, a word may appear on more than one section, and words that should span the boundary between clients may only appear on one section. This applies not only to visualizations that you create, but also to existing websites thay you may want to display: for example, the order of items in a news-feed may change each time it is loaded, and some sites display a list of randomly selected links to related pages.

**Browser versions**. You should ensure that your content displays correctly in the specific browser version used in the OVE environment where you will be displaying your content. This may well be an older version than the version that is installed on your development machine, as software auto-updates may have been disabled in the production environment.

**Custom libraries**. The core OVE apps use stable libraries tested on all DSI visualization environments; if certain features are not working or not tested, these will be stated in the app description. If you use the HTML app to embed content that depends on third-party libraries, you should ensure that they support sufficiently high screen resolutions: for example, chart.js stops rendering area charts at 17000 pixels (less than the horizontal width of the [Data Observatory](https://www.imperial.ac.uk/data-science/data-observatory/) at Imperial, which has a resolution of 30720x4320 pixels). Device emulation within Chrome may assist with this process.

**Time Synchronisation**. Be aware that the clocks on each machine will not be precisely aligned and cannot be used to time animation without taking into account clock drift. 

**Server scalability**. If a section spans multiple OVE clients, then each may make near-simultaneous requests for the same content (e.g., webpages in the case of the HTML app, or image tiles in the case of the images app). You should ensure that whatever server is deployed to serve these requests to configured to handle the expected load. Additionally, if you are loading content from a third-party service using an API, you should ensure that you will not exceed limits on the peak request frequency (which could result in your requests being throttled or API key revoked).


## Ergonomic considerations

**Background colours**. White backgrounds may be blinding when displayed on multiple monitors. Dark or black backgrounds will help to hide screen bezels, which can be distracting.

**Content density**. When designing your visualisation and content for a High Resolution environment be aware that content that looks "dense" on a laptop will look very sparse and spread-out when displayed upon a large screen.

**Content sizing**. Ensure that your content is readable from the distance at which you expect it to be reads

**Content positioning**. If presenting to standing audience, do not rely on viewers being able to read the lower third of the screen, and position titles high up. For large charts, it is good practice to duplicate any chart legends so that no part of the chart is far away from the legend. Position things to minimise the interruption of important features by bezels. 

**Content flow**. Think carefully about how you will arrange content. This is particularly important when using a large immersive display, as viewers may have to turn their heads or walk across a room in order to look at a different part of the display, rather than simply moving their eyes. A common practice is to arrange things in order from left to right, and from top to bottom.

**Animation**. Animation which look reasonable on your laptop screen may become nauseating when viewed on a large screen. To avoid this, animated motion should be slow. Sequentially zooming out, panning, and then zooming back in can also be less nauseating than directly animating a pan in a zoomed-in view.


## User interaction considerations

**Controller mobility**. If you intend to present to an audience, consider creating a control panel that can operated using a phone or tablet so that you can move around without being tethered to a particular location.

**Multiple control panels**. Be aware that it is common practice to run multiple control panels for your visualisations, you should design your content to support this. Specifically this means that control panels should not hold unique state: if they hold state, this should be shared with other control panels (either by using the OVE framework's API endpoints to save and load state, or by communicating directly using a WebSocket). When a new control panel loads it should not reset the display.
