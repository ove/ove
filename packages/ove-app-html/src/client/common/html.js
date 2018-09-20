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
    $('.html-frame').hide();
    setTimeout(function () {
        setTimeout(function () {
            $('.html-frame').show();
        // helps browsers pre-load content before displaying page
        }, typeof window.ove.state.current.launchDelay !== 'undefined' ? window.ove.state.current.launchDelay : 0);
        $('.html-frame').attr('src', window.ove.state.current.url);
        // helps browsers load content precisely at the same time
    }, (window.ove.state.current.changeAt || new Date().getTime()) - new Date().getTime());
};
