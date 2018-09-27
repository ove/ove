//-- IMPORTANT: all code comments must be in this format. --//

OVE.Utils = new OVEUtils();
function OVEUtils () {
    //-----------------------------------------------------------//
    //--                  Utilities for JSON                   --//
    //-----------------------------------------------------------//
    this.JSON = {};
    this.JSON.equals = function (param1, param2) {
        return JSON.stringify(param1) === JSON.stringify(param2);
    };

    //-----------------------------------------------------------//
    //--                   Other Utilities                     --//
    //-----------------------------------------------------------//
    this.getQueryParam = function (name, defaultValue) {
        if (typeof defaultValue !== 'undefined') {
            return new URLSearchParams(location.search.slice(1)).get(name) || defaultValue;
        }
        return new URLSearchParams(location.search.slice(1)).get(name);
    };
}
