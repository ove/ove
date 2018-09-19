initControl = function (data) {
    let context = window.ove.context;
    context.isInitialized = false;

    let sectionWidth = window.ove.layout.section.w;
    let sectionHeight = window.ove.layout.section.h;
    let sectionRatio = sectionWidth / sectionHeight;
    let controlMaxWidth = Math.min(document.documentElement.clientWidth, window.innerWidth);
    let controlMaxHeight = Math.min(document.documentElement.clientHeight, window.innerHeight);
    let controlRatio = controlMaxWidth / controlMaxHeight;
    let controlWidth = 700;
    let controlHeight = 350;
    if (sectionRatio >= controlRatio) {
        controlWidth = controlMaxWidth;
        controlHeight = (sectionHeight * controlWidth) / sectionWidth;
    } else {
        controlHeight = controlMaxHeight;
        controlWidth = (sectionWidth * controlHeight) / sectionHeight;
    }

    $('#vegaArea').css('width', controlWidth);
    $('#vegaArea').css('height', controlHeight);
    window.ove.state.current = data;
    loadVega();
    window.ove.socket.send('charts', window.ove.state.current);
    window.ove.state.cache();
};

beginInitialization = function () {
    $(document).on('ove.loaded', function () {
        let state = window.ove.state.name || 'VegaSample';
        $.ajax({ url: 'state/' + state, dataType: 'json' }).done(function (data) {
            initControl(data);
        });
    });
};
