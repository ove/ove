# Potential pitfalls

There are several potential pitfalls that you should be aware of when developing visualisation applications and content that will be displayed using OVE. Larger displays (in either physical dimensions or resolution) present more challenges, and some of these pitfalls are less of a concern for an OVE installation of a smaller scale.

## Technical considerations

**Deterministic layout and rendering**. If a section spans multiple clients, you should ensure that each client renders its part of the section in a way that is consistent with the other clients. For example, if a word-cloud is drawn using a random algorithm that is performed independently on each client, a word may appear on more than one client, and words that should span the boundary between two clients may only appear on one client. This applies not only to visualizations that you create, but also to existing websites thay you may want to display: for example, the order of items in a news-feed may change each time it is loaded, and some sites display a list of randomly selected links to related pages.

**Browser versions**. You should ensure that your content displays correctly in the specific browser version used in the OVE environment where you will be displaying your content. This may well be an older version than the version that is installed on your development machine, as software auto-updates may have been disabled in production environments.

**Custom libraries**. The core OVE apps use stable libraries tested on all DSI visualization environments; if certain features are not working or not tested, these will be stated in the app description. If you use the HTML app to embed content that depends on third-party libraries, you should ensure that they support sufficiently high screen resolutions: for example, chart.js stops rendering area charts at 17000 pixels (less than the horizontal width of the [Data Observatory](https://www.imperial.ac.uk/data-science/data-observatory/) at Imperial, which has a resolution of 30720x4320 pixels). Device emulation within Chrome may assist with this process.

**Time synchronisation**. Be aware that the clocks on each machine may not be precisely synchronised and cannot be used to time animations without taking clock drift into account.

**Server scalability**. If a section spans multiple OVE clients, then each may make near-simultaneous requests for the same content (e.g., webpages in the case of the HTML app, or image tiles in the case of the images app). You should ensure that whatever server(s) that is deployed to serve these requests to be configured to handle the expected load. Additionally, if you are loading content from a third-party service using an API, you should ensure that you will not exceed limits on the peak request frequency (which could result in your requests being throttled or API keys revoked).

**Frame options**. A website can set the [X-Frame-Options](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options) header to indicate that it should not be embedded in an [iframe](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe); this will prevent it from being loaded by the OVE HTML app. Some websites use this mechanism to disallow embedding except for specific alternative URLs.

## Ergonomic considerations

**Background colours**. White backgrounds may be blinding when displayed on multiple monitors. Dark or black backgrounds will help to hide screen bezels, which can otherwise be distracting.

**Content density**. When designing your visualisation and content for a high resolution environment, be aware that content that looks dense on a laptop may look very sparse and spread-out when displayed upon a large screen.

**Content sizing**. Ensure that your content is readable from the distance at which you expect it to be read by your audience.

**Content positioning**. If presenting to a standing audience, do not rely on viewers being able to read the lower third of the display area, and position titles high up. For large charts, it is a good practice to duplicate any chart legends so that no part of the chart is far away from the legend. Position content to minimise the interruption of important features by bezels.

**Content flow**. Think carefully about how you will arrange content. This is particularly important when using a large immersive display, as viewers may have to turn their heads or walk across a room in order to look at a different part of the display, rather than simply moving their eyes. A common practice is to arrange things in order from left to right, and from top to bottom.

**Animation**. Animation which look reasonable on your laptop screen may become nauseating when viewed on a large screen. To avoid this, animated motion should be slow. Sequentially zooming out, panning, and then zooming back in can also be less nauseating than directly animating a pan in a zoomed-in view.

## User interaction considerations

**Controller mobility**. If you intend to present to a larger audience, consider creating a control panel that can be operated using a phone or tablet so that you can move around without being tethered to a particular location.

**Multiple control panels**. Be aware that it is common practice to run multiple control panels for your visualisations; you should design your content to support this. Specifically, this means that control panels should not hold unique state: if they hold state, this should be shared with other control panels (either by using the OVE framework's API endpoints to save and load state, or by communicating directly using a WebSocket). When a new control panel loads, it should not reset the display.
