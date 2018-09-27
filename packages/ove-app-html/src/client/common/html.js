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
            class: 'html-frame',
            frameborder: 0,
            scrolling: 'no'
        }).css(getCSS()).appendTo('.wrapper');
        window.ove.context.isInitialized = true;
    }
    const state = window.ove.state.current;
    const launchDelay = typeof state.launchDelay !== 'undefined' ? state.launchDelay : 0;
    if (launchDelay > 0) {
        $('.html-frame').hide();
    }
    setTimeout(function () {
        if (launchDelay > 0) {
            setTimeout(function () {
                $('.html-frame').show();
            // helps browsers pre-load content before displaying page
            }, launchDelay);
        }
        $('.html-frame').attr('src', state.url);
        // helps browsers load content precisely at the same time
    }, (state.changeAt || new Date().getTime()) - new Date().getTime());
};
