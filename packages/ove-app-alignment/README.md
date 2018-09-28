# OVE monitor alignment app

## Purpose

This application exists to help align the monitors in an OVE installation.

When installing monitors to create a tiled display, the aim is typically to physically align screens with as little space between them as possible.
However, in practice it is difficult to achieve a perfect alignment and monitors have bezels with non-zero widths.
To compensate for this, adjustments can be made to the coordinates recorded for the layout in the``Clients.json`` file.


## Use

It enables the display of one of two patterns (a grid of vertical and horizontal lines, or a series of parallel diagonal lines) that span an entire space.

From the controller page, a user can select one or more OVE clients, use the arrow keys to move the pattern on these clients until it aligns with the others, and then export a ``Clients.json`` file.

The grid pattern allows creation of an alignment such that bezels are ignored: are pixels of the content are displayed, and the bottom pixel of one monitor and the top pixel of the monitor below have adjacent image coordinates, but are separated in physical space by the bezel width.

The diagonal pattern allows the creation of an alignment that compensates for bezels: the bottom pixel of one monitor and the top pixel of the monitor below do *not* have adjacent image coordinates; instead, content will be displayed as if it was on a continuous surface behind the bezels, with bezels occluding some content.

Users may want to perform both alignment procedures, and save the results as separate configurations in ``Clients.json``.

Note that when loading the controller page, you must include the ``spaceName`` as the ``oveClientId`` parameter in the URL: ``http://<app-host>/control.html?oveSectionId=<sectionId>&oveClientId=<spaceName>``