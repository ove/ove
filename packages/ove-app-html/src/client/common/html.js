$(function () {
    // This is what happens first. After OVE is loaded, either the viewer or controller
    // will be initialized.
    $(document).ready(function () {
        window.ove = new OVE();
        window.ove.context.isInitialized = false;
        beginInitialization();
    });
});

updateURL = function () {
    if (!window.ove.context.isInitialized) {
        $('<iframe>', {
            class: Constants.HTML_FRAME.substring(1),
            frameborder: 0,
            scrolling: 'no'
        }).css(getCSS()).appendTo(Constants.CONTENT_DIV);
        window.ove.context.isInitialized = true;
    }
    const state = window.ove.state.current;

    // A delayed launch helps browsers pre-load content before displaying page
    // If there is no launch-delay, there is no point in showing/hiding frame.
    const launchDelay = typeof state.launchDelay !== 'undefined' ? state.launchDelay : 0;
    if (launchDelay > 0) {
        $(Constants.HTML_FRAME).hide();
    }

    // A timed change helps browsers load content precisely at the same time.
    const timeUntilChange = (state.changeAt || new Date().getTime()) - new Date().getTime();
    setTimeout(function () {
        if (launchDelay > 0) {
            setTimeout(function () { $(Constants.HTML_FRAME).show(); }, launchDelay);
        }
        $(Constants.HTML_FRAME).attr('src', state.url);
    }, timeUntilChange);
};
