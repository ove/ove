$(function () {
    $(document).ready(function () {
        window.ove = new OVE();
        window.ove.context.isInitialized = false;
        beginInitialization();
    });
});

updateURL = function () {
    let context = window.ove.context;
    if (!context.isInitialized) {
        $('<iframe>', {
            class: 'html-frame',
            frameborder: 0,
            scrolling: 'no'
        }).css(getCSS()).appendTo('.wrapper');
        context.isInitialized = true;
    }
    let current = window.ove.state.current;
    let launchDelay = typeof current.launchDelay !== 'undefined' ? current.launchDelay : 0;
    if (launchDelay > 0) {
        $('.html-frame').hide();
    }
    setTimeout(function () {
        if (launchDelay > 0) {
            setTimeout(function () {
                $('.html-frame').show();
            // helps browsers pre-load content before displaying page
            }, current.launchDelay);
        }
        $('.html-frame').attr('src', current.url);
        // helps browsers load content precisely at the same time
    }, (current.changeAt || new Date().getTime()) - new Date().getTime());
};
