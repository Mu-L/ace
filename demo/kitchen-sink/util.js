"use strict";

var dom = require("ace/lib/dom");
var event = require("ace/lib/event");

var EditSession = require("ace/edit_session").EditSession;
var UndoManager = require("ace/undomanager").UndoManager;
var Renderer = require("ace/virtual_renderer").VirtualRenderer;
var Editor = require("ace/editor").Editor;
var MultiSelect = require("ace/multi_select").MultiSelect;

var urlOptions = {}
try {
    window.location.search.slice(1).split(/[&]/).forEach(function(e) {
        var parts = e.split("=");
        urlOptions[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1]);
    });
} catch(e) {
    console.error(e);
}
exports.createEditor = function(el) {
    return new Editor(new Renderer(el));
};

exports.getOption = function(name) {
    if (urlOptions[name])
        return urlOptions[name];
    return localStorage && localStorage.getItem(name);
};

exports.saveOption = function(name, value) {
    if (value == false)
        value = "";
    localStorage && localStorage.setItem(name, value);
};

exports.createSplitEditor = function(el) {
    if (typeof(el) == "string")
        el = document.getElementById(el);

    var e0 = document.createElement("div");
    var s = document.createElement("splitter");
    var e1 = document.createElement("div");
    el.appendChild(e0);
    el.appendChild(e1);
    el.appendChild(s);
    e0.style.position = e1.style.position = s.style.position = "absolute";
    el.style.position = "relative";
    var split = {$container: el};

    split.editor0 = split[0] = new Editor(new Renderer(e0));
    split.editor0.session.setUndoManager(new UndoManager());
    split.editor1 = split[1] = new Editor(new Renderer(e1));
    split.editor1.session.setUndoManager(new UndoManager());
    split.splitter = s;

    s.ratio = 0.5;

    split.resize = function resize(){
        var height = el.parentNode.clientHeight - el.offsetTop;
        var total = el.clientWidth;
        var w1 = total * s.ratio;
        var w2 = total * (1- s.ratio);
        s.style.left = w1 - 1 + "px";
        s.style.height = el.style.height = height + "px";

        var st0 = split[0].container.style;
        var st1 = split[1].container.style;
        st0.width = w1 + "px";
        st1.width = w2 + "px";
        st0.left = 0 + "px";
        st1.left = w1 + "px";

        st0.top = st1.top = "0px";
        st0.height = st1.height = height + "px";

        split[0].resize();
        split[1].resize();
    };

    split.onMouseDown = function(e) {
        var rect = el.getBoundingClientRect();
        var x = e.clientX;
        var y = e.clientY;

        var button = e.button;
        if (button !== 0) {
            return;
        }

        var onMouseMove = function(e) {
            x = e.clientX;
            y = e.clientY;
        };
        var onResizeEnd = function(e) {
            clearInterval(timerId);
        };

        var onResizeInterval = function() {
            s.ratio = (x - rect.left) / rect.width;
            split.resize();
        };

        event.capture(s, onMouseMove, onResizeEnd);
        var timerId = setInterval(onResizeInterval, 40);

        return e.preventDefault();
    };



    event.addListener(s, "mousedown", split.onMouseDown);
    event.addListener(window, "resize", split.resize);
    split.resize();
    return split;
};

/***************************/
exports.stripLeadingComments = function(str) {
    if(str.slice(0,2)=='/*') {
        var j = str.indexOf('*/')+2;
        str = str.substr(j);
    }
    return str.trim() + "\n";
};

/***************************/
function saveOptionFromElement(el, val) {
    if (!el.onchange && !el.onclick)
        return;

    if ("checked" in el) {
        localStorage && localStorage.setItem(el.id, el.checked ? 1 : 0);
    }
    else {
        localStorage && localStorage.setItem(el.id, el.value);
    }
}

exports.bindCheckbox = function(id, callback, noInit) {
    if (typeof id == "string")
        var el = document.getElementById(id);
    else {
        var el = id;
        id = el.id;
    }
    var el = document.getElementById(id);
    
    if (urlOptions[id])
        el.checked = urlOptions[id] == "1";
    else if (localStorage && localStorage.getItem(id))
        el.checked = localStorage.getItem(id) == "1";

    var onCheck = function() {
        callback(!!el.checked);
        saveOptionFromElement(el);
    };
    el.onclick = onCheck;
    noInit || onCheck();
    return el;
};

exports.bindDropdown = function(id, callback, noInit) {
    if (typeof id == "string")
        var el = document.getElementById(id);
    else {
        var el = id;
        id = el.id;
    }
    
    if (urlOptions[id])
        el.value = urlOptions[id];
    else if (localStorage && localStorage.getItem(id))
        el.value = localStorage.getItem(id);

    var onChange = function() {
        callback(el.value);
        saveOptionFromElement(el);
    };

    el.onchange = onChange;
    noInit || onChange();
};

exports.fillDropdown = function(el, values) {
    if (typeof el == "string")
        el = document.getElementById(el);

    dropdown(values).forEach(function(e) {
        el.appendChild(e);
    });
};

function elt(tag, attributes, content) {
    var el = dom.createElement(tag);
    if (typeof content == "string") {
        el.appendChild(document.createTextNode(content));
    } else if (content) {
        content.forEach(function(ch) {
            el.appendChild(ch);
        });
    }

    for (var i in attributes)
        el.setAttribute(i, attributes[i]);
    return el;
}

function optgroup(values) {
    return values.map(function(item) {
        if (typeof item == "string")
            item = {name: item, caption: item};
        return elt("option", {value: item.value || item.name}, item.caption || item.desc);
    });
}

function dropdown(values) {
    if (Array.isArray(values))
        return optgroup(values);

    return Object.keys(values).map(function(i) {
        return elt("optgroup", {"label": i}, optgroup(values[i]));
    });
}
