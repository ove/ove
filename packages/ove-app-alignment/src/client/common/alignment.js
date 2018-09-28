$(function () {
    $(document).on(OVE.Event.LOADED, function () {
        initPage({});
    });

    $(document).ready(function () {
        window.ove = new OVE();
        window.ove.context.isInitialized = false;
    });
});

function buildClientsURL () {
    let serverURL = '';

    const scripts = document.getElementsByTagName('script');
    for (let i = 0; i < scripts.length; i++) {
        if (scripts[i].src.indexOf('ove.js') > 0) {
            serverURL = scripts[i].src.substr(0, scripts[i].src.lastIndexOf('/') + 1);
        }
    }

    return serverURL + 'clients';
}


function getSpaceId () {
    const id = new URLSearchParams(location.search.slice(1)).get('oveClientId');
    return id.substr(0, id.lastIndexOf('-'));
}

function getClientId(){
    const id = new URLSearchParams(location.search.slice(1)).get('oveClientId');
    const parts = id.split('-');
    return +parts[parts.length - 1];
}