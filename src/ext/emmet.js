/**
 * ## Emmet extension
 *
 * Providing HTML/CSS abbreviation expansion, code navigation, and text editing utilities with configurable options and
 * keyboard shortcuts for rapid web development workflow.
 *
 * **Enable:** `editor.setOption("enableEmmet", true)`
 * or configure it during editor initialization in the options object.
 * @module
 */
"use strict";
var HashHandler = require("../keyboard/hash_handler").HashHandler;
var Editor = require("../editor").Editor;
var snippetManager = require("../snippets").snippetManager;
var Range = require("../range").Range;
var config = require("../config");
var emmet, emmetPath;

/**
 * Implementation of {@link IEmmetEditor} interface for Ace
 */

class AceEmmetEditor {
    /**
     * @param {Editor} editor
     */
    setupContext(editor) {
        this.ace = editor;
        this.indentation = editor.session.getTabString();
        if (!emmet)
            emmet = window["emmet"];
        var resources = emmet.resources || emmet.require("resources");
        resources.setVariable("indentation", this.indentation);
        this.$syntax = null;
        this.$syntax = this.getSyntax();
    }
    /**
     * Returns character indexes of selected text: object with <code>start</code>
     * and <code>end</code> properties. If there's no selection, should return
     * object with <code>start</code> and <code>end</code> properties referring
     * to current caret position
     * @return {Object}
     * @example
     * var selection = editor.getSelectionRange();
     * alert(selection.start + ', ' + selection.end);
     */
    getSelectionRange() {
        // TODO should start be caret position instead?
        var range = this.ace.getSelectionRange();
        var doc = this.ace.session.doc;
        return {
            start: doc.positionToIndex(range.start),
            end: doc.positionToIndex(range.end)
        };
    }

    /**
     * Creates selection from <code>start</code> to <code>end</code> character
     * indexes. If <code>end</code> is ommited, this method should place caret
     * and <code>start</code> index
     * @param {Number} start
     * @param {Number} [end]
     * @example
     * editor.createSelection(10, 40);
     *
     * //move caret to 15th character
     * editor.createSelection(15);
     */
    createSelection(start, end) {
        var doc = this.ace.session.doc;
        this.ace.selection.setRange({
            start: doc.indexToPosition(start),
            end: doc.indexToPosition(end)
        });
    }

    /**
     * Returns current line's start and end indexes as object with <code>start</code>
     * and <code>end</code> properties
     * @return {Object}
     * @example
     * var range = editor.getCurrentLineRange();
     * alert(range.start + ', ' + range.end);
     */
    getCurrentLineRange() {
        var ace = this.ace;
        var row = ace.getCursorPosition().row;
        var lineLength = ace.session.getLine(row).length;
        var index = ace.session.doc.positionToIndex({row: row, column: 0});
        return {
            start: index,
            end: index + lineLength
        };
    }

    /**
     * Returns current caret position
     * @return {Number|null}
     */
    getCaretPos(){
        var pos = this.ace.getCursorPosition();
        return this.ace.session.doc.positionToIndex(pos);
    }

    /**
     * Set new caret position
     * @param {Number} index Caret position
     */
    setCaretPos(index){
        var pos = this.ace.session.doc.indexToPosition(index);
        this.ace.selection.moveToPosition(pos);
    }

    /**
     * Returns content of current line
     * @return {String}
     */
    getCurrentLine() {
        var row = this.ace.getCursorPosition().row;
        return this.ace.session.getLine(row);
    }

    /**
     * Replace editor's content or it's part (from <code>start</code> to
     * <code>end</code> index). If <code>value</code> contains
     * <code>caret_placeholder</code>, the editor will put caret into
     * this position. If you skip <code>start</code> and <code>end</code>
     * arguments, the whole target's content will be replaced with
     * <code>value</code>.
     *
     * If you pass <code>start</code> argument only,
     * the <code>value</code> will be placed at <code>start</code> string
     * index of current content.
     *
     * If you pass <code>start</code> and <code>end</code> arguments,
     * the corresponding substring of current target's content will be
     * replaced with <code>value</code>.
     * @param {String} value Content you want to paste
     * @param {Number} [start] Start index of editor's content
     * @param {Number} [end] End index of editor's content
     * @param {Boolean} [noIndent] Do not auto indent <code>value</code>
     */
    replaceContent(value, start, end, noIndent) {
        if (end == null)
            end = start == null ? this.getContent().length : start;
        if (start == null)
            start = 0;        
        
        var editor = this.ace;
        var doc = editor.session.doc;
        var range = Range.fromPoints(doc.indexToPosition(start), doc.indexToPosition(end));
        editor.session.remove(range);
        
        range.end = range.start;
        //editor.selection.setRange(range);
        
        value = this.$updateTabstops(value);
        snippetManager.insertSnippet(editor, value);
    }

    /**
     * Returns editor's content
     * @return {String}
     */
    getContent(){
        return this.ace.getValue();
    }

    /**
     * Returns current editor's syntax mode
     * @return {String}
     */
    getSyntax() {
        if (this.$syntax)
            return this.$syntax;
        var syntax = this.ace.session.$modeId.split("/").pop();
        if (syntax == "html" || syntax == "php") {
            var cursor = this.ace.getCursorPosition();
            /**@type {string | string[]} */
            var state = this.ace.session.getState(cursor.row);
            if (typeof state != "string")
                state = state[0];
            if (state) {
                state = state.split("-");
                if (state.length > 1)
                    syntax = state[0];
                else if (syntax == "php")
                    syntax = "html";
            }
        }
        return syntax;
    }

    /**
     * Returns current output profile name (@see emmet#setupProfile)
     * @return {String}
     */
    getProfileName() {
        var resources = emmet.resources || emmet.require("resources");
        switch (this.getSyntax()) {
          case "css": return "css";
          case "xml":
          case "xsl":
            return "xml";
          case "html":
            var profile = resources.getVariable("profile");
            // no forced profile, guess from content html or xhtml?
            if (!profile)
                profile = this.ace.session.getLines(0,2).join("").search(/<!DOCTYPE[^>]+XHTML/i) != -1 ? "xhtml": "html";
            return profile;
          default:
            var mode = this.ace.session.$mode;
            return mode.emmetConfig && mode.emmetConfig.profile || "xhtml";
        }
    }

    /**
     * Ask user to enter something
     * @param {String} title Dialog title
     * @return {String} Entered data
     * @since 0.65
     */
    prompt(title) {
        return prompt(title); // eslint-disable-line no-alert
    }

    /**
     * Returns current selection
     * @return {String}
     * @since 0.65
     */
    getSelection() {
        return this.ace.session.getTextRange();
    }

    /**
     * Returns current editor's file path
     * @return {String}
     * @since 0.65
     */
    getFilePath() {
        return "";
    }
    
    // update tabstops: make sure all caret placeholders are unique
    // by default, abbreviation parser generates all unlinked (un-mirrored)
    // tabstops as ${0}, so we have upgrade all caret tabstops with unique
    // positions but make sure that all other tabstops are not linked accidentally
    // based on https://github.com/sergeche/emmet-sublime/blob/master/editor.js#L119-L171
    /**
     * @param {string} value
     */
    $updateTabstops(value) {
        var base = 1000;
        var zeroBase = 0;
        var lastZero = null;
        var ts = emmet.tabStops || emmet.require('tabStops');
        var resources = emmet.resources || emmet.require("resources");
        var settings = resources.getVocabulary("user");
        var tabstopOptions = {
            tabstop: function(data) {
                var group = parseInt(data.group, 10);
                var isZero = group === 0;
                if (isZero)
                    group = ++zeroBase;
                else
                    group += base;

                var placeholder = data.placeholder;
                if (placeholder) {
                    // recursively update nested tabstops
                    placeholder = ts.processText(placeholder, tabstopOptions);
                }

                var result = '${' + group + (placeholder ? ':' + placeholder : '') + '}';

                if (isZero) {
                    lastZero = [data.start, result];
                }

                return result;
            },
            escape: function(ch) {
                if (ch == '$') return '\\$';
                if (ch == '\\') return '\\\\';
                return ch;
            }
        };

        value = ts.processText(value, tabstopOptions);

        if (settings.variables['insert_final_tabstop'] && !/\$\{0\}$/.test(value)) {
            value += '${0}';
        } else if (lastZero) {
            var common = emmet.utils ? emmet.utils.common : emmet.require('utils');
            value = common.replaceSubstring(value, '${0}', lastZero[0], lastZero[1]);
        }
        
        return value;
    }
}


var keymap = {
    expand_abbreviation: {"mac": "ctrl+alt+e", "win": "alt+e"},
    match_pair_outward: {"mac": "ctrl+d", "win": "ctrl+,"},
    match_pair_inward: {"mac": "ctrl+j", "win": "ctrl+shift+0"},
    matching_pair: {"mac": "ctrl+alt+j", "win": "alt+j"},
    next_edit_point: "alt+right",
    prev_edit_point: "alt+left",
    toggle_comment: {"mac": "command+/", "win": "ctrl+/"},
    split_join_tag: {"mac": "shift+command+'", "win": "shift+ctrl+`"},
    remove_tag: {"mac": "command+'", "win": "shift+ctrl+;"},
    evaluate_math_expression: {"mac": "shift+command+y", "win": "shift+ctrl+y"},
    increment_number_by_1: "ctrl+up",
    decrement_number_by_1: "ctrl+down",
    increment_number_by_01: "alt+up",
    decrement_number_by_01: "alt+down",
    increment_number_by_10: {"mac": "alt+command+up", "win": "shift+alt+up"},
    decrement_number_by_10: {"mac": "alt+command+down", "win": "shift+alt+down"},
    select_next_item: {"mac": "shift+command+.", "win": "shift+ctrl+."},
    select_previous_item: {"mac": "shift+command+,", "win": "shift+ctrl+,"},
    reflect_css_value: {"mac": "shift+command+r", "win": "shift+ctrl+r"},

    encode_decode_data_url: {"mac": "shift+ctrl+d", "win": "ctrl+'"},
    // update_image_size: {"mac": "shift+ctrl+i", "win": "ctrl+u"},
    // expand_as_you_type: "ctrl+alt+enter",
    // wrap_as_you_type: {"mac": "shift+ctrl+g", "win": "shift+ctrl+g"},
    expand_abbreviation_with_tab: "Tab",
    wrap_with_abbreviation: {"mac": "shift+ctrl+a", "win": "shift+ctrl+a"}
};

var editorProxy = new AceEmmetEditor();
exports.commands = new HashHandler();

/**
 * Runs an Emmet command on the given editor.
 *
 * @param {Editor} editor - The Ace editor instance to run the Emmet command on
 * @return {ReturnType<typeof setTimeout> | boolean} The result of the Emmet command execution
 */
exports.runEmmetCommand = function runEmmetCommand(editor) {
    if (this.action == "expand_abbreviation_with_tab") {
        if (!editor.selection.isEmpty())
            return false;
        var pos = editor.selection.lead;
        var token = editor.session.getTokenAt(pos.row, pos.column);
        if (token && /\btag\b/.test(token.type))
            return false;
    }
    try {
        editorProxy.setupContext(editor);
        var actions = emmet.actions || emmet.require("actions");
        
        if (this.action == "wrap_with_abbreviation") {
            // without setTimeout prompt doesn't work on firefox
            return setTimeout(function() {
                actions.run("wrap_with_abbreviation", editorProxy);
            }, 0);
        }
        
        var result = actions.run(this.action, editorProxy);
    } catch(e) {
        if (!emmet) {
            var loading = exports.load(runEmmetCommand.bind(this, editor));
            if (this.action == "expand_abbreviation_with_tab")
                return false;
            return loading;
        }
        editor._signal("changeStatus", typeof e == "string" ? e : e.message);
        config.warn(e);
        result = false;
    }
    return result;
};

for (var command in keymap) {
    exports.commands.addCommand({
        name: "emmet:" + command,
        action: command,
        bindKey: keymap[command],
        exec: exports.runEmmetCommand,
        multiSelectAction: "forEach"
    });
}

/**
 * Updates the keyboard handler for Emmet commands in the editor.
 *
 * @param {Editor} editor - The Ace editor instance
 * @param {boolean} [enabled] - Whether Emmet commands should be enabled
 */
exports.updateCommands = function(editor, enabled) {
    if (enabled) {
        editor.keyBinding.addKeyboardHandler(exports.commands);
    } else {
        editor.keyBinding.removeKeyboardHandler(exports.commands);
    }
};

/**
 * Determines if a given editor mode is supported by Emmet.
 *
 * @param {Object|string} mode - The editor mode to check for Emmet support
 * @returns {boolean} Whether the mode is supported by Emmet
 */
exports.isSupportedMode = function(mode) {
    if (!mode) return false;
    if (mode.emmetConfig) return true;
    var id = mode.$id || mode;
    return /css|less|scss|sass|stylus|html|php|twig|ejs|handlebars/.test(id);
};

/**
 * Checks if an Emmet command is available for the current editor context.
 *
 * @param {Editor} editor - The current Ace editor instance
 * @param {string} command - The Emmet command to check availability for
 * @return {boolean} Whether the command is available in the current editor mode
 */
exports.isAvailable = function(editor, command) {
    if (/(evaluate_math_expression|expand_abbreviation)$/.test(command))
        return true;
    var mode = editor.session.$mode;
    var isSupported = exports.isSupportedMode(mode);
    if (isSupported && mode.$modes) {
        // TODO refactor mode delegates to make this simpler
        try {
            editorProxy.setupContext(editor);
            if (/js|php/.test(editorProxy.getSyntax()))
                isSupported = false;
        } catch(e) {}
    }
    return isSupported;
};

var onChangeMode = function(e, target) {
    var editor = target;
    if (!editor)
        return;
    var enabled = exports.isSupportedMode(editor.session.$mode);
    if (e.enableEmmet === false)
        enabled = false;
    if (enabled)
        exports.load();
    exports.updateCommands(editor, enabled);
};

/**
 * Loads the Emmet core module dynamically.
 *
 * @param {Function} [cb] - Optional callback function to be executed after module loading
 * @return {boolean} Whether the Emmet core module loading was initiated successfully
 */
exports.load = function(cb) {
    if (typeof emmetPath !== "string") {
        config.warn("script for emmet-core is not loaded");
        return false;
    }
    config.loadModule(emmetPath, function() {
        emmetPath = null;
        cb && cb();
    });
    return true;
};

exports.AceEmmetEditor = AceEmmetEditor;
config.defineOptions(Editor.prototype, "editor", {
    enableEmmet: {
        set: function(val) {
            this[val ? "on" : "removeListener"]("changeMode", onChangeMode);
            onChangeMode({enableEmmet: !!val}, this);
        },
        value: true
    }
});

/**
 * Sets the Emmet core module or path.
 *
 * @param {string|Object} e - Either the path to the Emmet core script or the Emmet core module itself
 * If a string is provided, it sets the path to load the Emmet core script.
 * If an object is provided, it directly sets the Emmet core module.
 */
exports.setCore = function(e) {
    if (typeof e == "string")
       emmetPath = e;
    else
       emmet = e;
};
