/*!
 * jQuery Form Plugin
 * version: 3.51.0-2014.06.20
 * Requires jQuery v1.5 or later
 * Copyright (c) 2014 M. Alsup
 * Examples and documentation at: http://malsup.com/jquery/form/
 * Project repository: https://github.com/malsup/form
 * Dual licensed under the MIT and GPL licenses.
 * https://github.com/malsup/form#copyright-and-license
 */
/*global ActiveXObject */

// AMD support
(function (factory) {
    "use strict";
    if (typeof define === 'function' && define.amd) {
        // using AMD; register as anon module
        define(['jquery'], factory);
    } else {
        // no AMD; invoke directly
        factory( (typeof(jQuery) != 'undefined') ? jQuery : window.Zepto );
    }
}

(function($) {
    "use strict";

    /*
     Usage Note:
     -----------
     Do not use both ajaxSubmit and ajaxForm on the same form.  These
     functions are mutually exclusive.  Use ajaxSubmit if you want
     to bind your own submit handler to the form.  For example,

     $(document).ready(function() {
     $('#myForm').on('submit', function(e) {
     e.preventDefault(); // <-- important
     $(this).ajaxSubmit({
     target: '#output'
     });
     });
     });

     Use ajaxForm when you want the plugin to manage all the event binding
     for you.  For example,

     $(document).ready(function() {
     $('#myForm').ajaxForm({
     target: '#output'
     });
     });

     You can also use ajaxForm with delegation (requires jQuery v1.7+), so the
     form does not have to exist when you invoke ajaxForm:

     $('#myForm').ajaxForm({
     delegation: true,
     target: '#output'
     });

     When using ajaxForm, the ajaxSubmit function will be invoked for you
     at the appropriate time.
     */

    /**
     * Feature detection
     */
    var feature = {};
    feature.fileapi = $("<input type='file'/>").get(0).files !== undefined;
    feature.formdata = window.FormData !== undefined;

    var hasProp = !!$.fn.prop;

// attr2 uses prop when it can but checks the return type for
// an expected string.  this accounts for the case where a form
// contains inputs with names like "action" or "method"; in those
// cases "prop" returns the element
    $.fn.attr2 = function() {
        if ( ! hasProp ) {
            return this.attr.apply(this, arguments);
        }
        var val = this.prop.apply(this, arguments);
        if ( ( val && val.jquery ) || typeof val === 'string' ) {
            return val;
        }
        return this.attr.apply(this, arguments);
    };

    /**
     * ajaxSubmit() provides a mechanism for immediately submitting
     * an HTML form using AJAX.
     */
    $.fn.ajaxSubmit = function(options) {
        /*jshint scripturl:true */

        // fast fail if nothing selected (http://dev.jquery.com/ticket/2752)
        if (!this.length) {
            log('ajaxSubmit: skipping submit process - no element selected');
            return this;
        }

        var method, action, url, $form = this;

        if (typeof options == 'function') {
            options = { success: options };
        }
        else if ( options === undefined ) {
            options = {};
        }

        method = options.type || this.attr2('method');
        action = options.url  || this.attr2('action');

        url = (typeof action === 'string') ? $.trim(action) : '';
        url = url || window.location.href || '';
        if (url) {
            // clean url (don't include hash vaue)
            url = (url.match(/^([^#]+)/)||[])[1];
        }

        options = $.extend(true, {
            url:  url,
            success: $.ajaxSettings.success,
            type: method || $.ajaxSettings.type,
            iframeSrc: /^https/i.test(window.location.href || '') ? 'javascript:false' : 'about:blank'
        }, options);

        // hook for manipulating the form data before it is extracted;
        // convenient for use with rich editors like tinyMCE or FCKEditor
        var veto = {};
        this.trigger('form-pre-serialize', [this, options, veto]);
        if (veto.veto) {
            log('ajaxSubmit: submit vetoed via form-pre-serialize trigger');
            return this;
        }

        // provide opportunity to alter form data before it is serialized
        if (options.beforeSerialize && options.beforeSerialize(this, options) === false) {
            log('ajaxSubmit: submit aborted via beforeSerialize callback');
            return this;
        }

        var traditional = options.traditional;
        if ( traditional === undefined ) {
            traditional = $.ajaxSettings.traditional;
        }

        var elements = [];
        var qx, a = this.formToArray(options.semantic, elements);
        if (options.data) {
            options.extraData = options.data;
            qx = $.param(options.data, traditional);
        }

        // give pre-submit callback an opportunity to abort the submit
        if (options.beforeSubmit && options.beforeSubmit(a, this, options) === false) {
            log('ajaxSubmit: submit aborted via beforeSubmit callback');
            return this;
        }

        // fire vetoable 'validate' event
        this.trigger('form-submit-validate', [a, this, options, veto]);
        if (veto.veto) {
            log('ajaxSubmit: submit vetoed via form-submit-validate trigger');
            return this;
        }

        var q = $.param(a, traditional);
        if (qx) {
            q = ( q ? (q + '&' + qx) : qx );
        }
        if (options.type.toUpperCase() == 'GET') {
            options.url += (options.url.indexOf('?') >= 0 ? '&' : '?') + q;
            options.data = null;  // data is null for 'get'
        }
        else {
            options.data = q; // data is the query string for 'post'
        }

        var callbacks = [];
        if (options.resetForm) {
            callbacks.push(function() { $form.resetForm(); });
        }
        if (options.clearForm) {
            callbacks.push(function() { $form.clearForm(options.includeHidden); });
        }

        // perform a load on the target only if dataType is not provided
        if (!options.dataType && options.target) {
            var oldSuccess = options.success || function(){};
            callbacks.push(function(data) {
                var fn = options.replaceTarget ? 'replaceWith' : 'html';
                $(options.target)[fn](data).each(oldSuccess, arguments);
            });
        }
        else if (options.success) {
            callbacks.push(options.success);
        }

        options.success = function(data, status, xhr) { // jQuery 1.4+ passes xhr as 3rd arg
            var context = options.context || this ;    // jQuery 1.4+ supports scope context
            for (var i=0, max=callbacks.length; i < max; i++) {
                callbacks[i].apply(context, [data, status, xhr || $form, $form]);
            }
        };

        if (options.error) {
            var oldError = options.error;
            options.error = function(xhr, status, error) {
                var context = options.context || this;
                oldError.apply(context, [xhr, status, error, $form]);
            };
        }

        if (options.complete) {
            var oldComplete = options.complete;
            options.complete = function(xhr, status) {
                var context = options.context || this;
                oldComplete.apply(context, [xhr, status, $form]);
            };
        }

        // are there files to upload?

        // [value] (issue #113), also see comment:
        // https://github.com/malsup/form/commit/588306aedba1de01388032d5f42a60159eea9228#commitcomment-2180219
        var fileInputs = $('input[type=file]:enabled', this).filter(function() { return $(this).val() !== ''; });

        var hasFileInputs = fileInputs.length > 0;
        var mp = 'multipart/form-data';
        var multipart = ($form.attr('enctype') == mp || $form.attr('encoding') == mp);

        var fileAPI = feature.fileapi && feature.formdata;
        log("fileAPI :" + fileAPI);
        var shouldUseFrame = (hasFileInputs || multipart) && !fileAPI;

        var jqxhr;

        // options.iframe allows user to force iframe mode
        // 06-NOV-09: now defaulting to iframe mode if file input is detected
        if (options.iframe !== false && (options.iframe || shouldUseFrame)) {
            // hack to fix Safari hang (thanks to Tim Molendijk for this)
            // see:  http://groups.google.com/group/jquery-dev/browse_thread/thread/36395b7ab510dd5d
            if (options.closeKeepAlive) {
                $.get(options.closeKeepAlive, function() {
                    jqxhr = fileUploadIframe(a);
                });
            }
            else {
                jqxhr = fileUploadIframe(a);
            }
        }
        else if ((hasFileInputs || multipart) && fileAPI) {
            jqxhr = fileUploadXhr(a);
        }
        else {
            jqxhr = $.ajax(options);
        }

        $form.removeData('jqxhr').data('jqxhr', jqxhr);

        // clear element array
        for (var k=0; k < elements.length; k++) {
            elements[k] = null;
        }

        // fire 'notify' event
        this.trigger('form-submit-notify', [this, options]);
        return this;

        // utility fn for deep serialization
        function deepSerialize(extraData){
            var serialized = $.param(extraData, options.traditional).split('&');
            var len = serialized.length;
            var result = [];
            var i, part;
            for (i=0; i < len; i++) {
                // #252; undo param space replacement
                serialized[i] = serialized[i].replace(/\+/g,' ');
                part = serialized[i].split('=');
                // #278; use array instead of object storage, favoring array serializations
                result.push([decodeURIComponent(part[0]), decodeURIComponent(part[1])]);
            }
            return result;
        }

        // XMLHttpRequest Level 2 file uploads (big hat tip to francois2metz)
        function fileUploadXhr(a) {
            var formdata = new FormData();

            for (var i=0; i < a.length; i++) {
                formdata.append(a[i].name, a[i].value);
            }

            if (options.extraData) {
                var serializedData = deepSerialize(options.extraData);
                for (i=0; i < serializedData.length; i++) {
                    if (serializedData[i]) {
                        formdata.append(serializedData[i][0], serializedData[i][1]);
                    }
                }
            }

            options.data = null;

            var s = $.extend(true, {}, $.ajaxSettings, options, {
                contentType: false,
                processData: false,
                cache: false,
                type: method || 'POST'
            });

            if (options.uploadProgress) {
                // workaround because jqXHR does not expose upload property
                s.xhr = function() {
                    var xhr = $.ajaxSettings.xhr();
                    if (xhr.upload) {
                        xhr.upload.addEventListener('progress', function(event) {
                            var percent = 0;
                            var position = event.loaded || event.position; /*event.position is deprecated*/
                            var total = event.total;
                            if (event.lengthComputable) {
                                percent = Math.ceil(position / total * 100);
                            }
                            options.uploadProgress(event, position, total, percent);
                        }, false);
                    }
                    return xhr;
                };
            }

            s.data = null;
            var beforeSend = s.beforeSend;
            s.beforeSend = function(xhr, o) {
                //Send FormData() provided by user
                if (options.formData) {
                    o.data = options.formData;
                }
                else {
                    o.data = formdata;
                }
                if(beforeSend) {
                    beforeSend.call(this, xhr, o);
                }
            };
            return $.ajax(s);
        }

        // private function for handling file uploads (hat tip to YAHOO!)
        function fileUploadIframe(a) {
            var form = $form[0], el, i, s, g, id, $io, io, xhr, sub, n, timedOut, timeoutHandle;
            var deferred = $.Deferred();

            // #341
            deferred.abort = function(status) {
                xhr.abort(status);
            };

            if (a) {
                // ensure that every serialized input is still enabled
                for (i=0; i < elements.length; i++) {
                    el = $(elements[i]);
                    if ( hasProp ) {
                        el.prop('disabled', false);
                    }
                    else {
                        el.removeAttr('disabled');
                    }
                }
            }

            s = $.extend(true, {}, $.ajaxSettings, options);
            s.context = s.context || s;
            id = 'jqFormIO' + (new Date().getTime());
            if (s.iframeTarget) {
                $io = $(s.iframeTarget);
                n = $io.attr2('name');
                if (!n) {
                    $io.attr2('name', id);
                }
                else {
                    id = n;
                }
            }
            else {
                $io = $('<iframe name="' + id + '" src="'+ s.iframeSrc +'" />');
                $io.css({ position: 'absolute', top: '-1000px', left: '-1000px' });
            }
            io = $io[0];


            xhr = { // mock object
                aborted: 0,
                responseText: null,
                responseXML: null,
                status: 0,
                statusText: 'n/a',
                getAllResponseHeaders: function() {},
                getResponseHeader: function() {},
                setRequestHeader: function() {},
                abort: function(status) {
                    var e = (status === 'timeout' ? 'timeout' : 'aborted');
                    log('aborting upload... ' + e);
                    this.aborted = 1;

                    try { // #214, #257
                        if (io.contentWindow.document.execCommand) {
                            io.contentWindow.document.execCommand('Stop');
                        }
                    }
                    catch(ignore) {}

                    $io.attr('src', s.iframeSrc); // abort op in progress
                    xhr.error = e;
                    if (s.error) {
                        s.error.call(s.context, xhr, e, status);
                    }
                    if (g) {
                        $.event.trigger("ajaxError", [xhr, s, e]);
                    }
                    if (s.complete) {
                        s.complete.call(s.context, xhr, e);
                    }
                }
            };

            g = s.global;
            // trigger ajax global events so that activity/block indicators work like normal
            if (g && 0 === $.active++) {
                $.event.trigger("ajaxStart");
            }
            if (g) {
                $.event.trigger("ajaxSend", [xhr, s]);
            }

            if (s.beforeSend && s.beforeSend.call(s.context, xhr, s) === false) {
                if (s.global) {
                    $.active--;
                }
                deferred.reject();
                return deferred;
            }
            if (xhr.aborted) {
                deferred.reject();
                return deferred;
            }

            // add submitting element to data if we know it
            sub = form.clk;
            if (sub) {
                n = sub.name;
                if (n && !sub.disabled) {
                    s.extraData = s.extraData || {};
                    s.extraData[n] = sub.value;
                    if (sub.type == "image") {
                        s.extraData[n+'.x'] = form.clk_x;
                        s.extraData[n+'.y'] = form.clk_y;
                    }
                }
            }

            var CLIENT_TIMEOUT_ABORT = 1;
            var SERVER_ABORT = 2;

            function getDoc(frame) {
                /* it looks like contentWindow or contentDocument do not
                 * carry the protocol property in ie8, when running under ssl
                 * frame.document is the only valid response document, since
                 * the protocol is know but not on the other two objects. strange?
                 * "Same origin policy" http://en.wikipedia.org/wiki/Same_origin_policy
                 */

                var doc = null;

                // IE8 cascading access check
                try {
                    if (frame.contentWindow) {
                        doc = frame.contentWindow.document;
                    }
                } catch(err) {
                    // IE8 access denied under ssl & missing protocol
                    log('cannot get iframe.contentWindow document: ' + err);
                }

                if (doc) { // successful getting content
                    return doc;
                }

                try { // simply checking may throw in ie8 under ssl or mismatched protocol
                    doc = frame.contentDocument ? frame.contentDocument : frame.document;
                } catch(err) {
                    // last attempt
                    log('cannot get iframe.contentDocument: ' + err);
                    doc = frame.document;
                }
                return doc;
            }

            // Rails CSRF hack (thanks to Yvan Barthelemy)
            var csrf_token = $('meta[name=csrf-token]').attr('content');
            var csrf_param = $('meta[name=csrf-param]').attr('content');
            if (csrf_param && csrf_token) {
                s.extraData = s.extraData || {};
                s.extraData[csrf_param] = csrf_token;
            }

            // take a breath so that pending repaints get some cpu time before the upload starts
            function doSubmit() {
                // make sure form attrs are set
                var t = $form.attr2('target'),
                    a = $form.attr2('action'),
                    mp = 'multipart/form-data',
                    et = $form.attr('enctype') || $form.attr('encoding') || mp;

                // update form attrs in IE friendly way
                form.setAttribute('target',id);
                if (!method || /post/i.test(method) ) {
                    form.setAttribute('method', 'POST');
                }
                if (a != s.url) {
                    form.setAttribute('action', s.url);
                }

                // ie borks in some cases when setting encoding
                if (! s.skipEncodingOverride && (!method || /post/i.test(method))) {
                    $form.attr({
                        encoding: 'multipart/form-data',
                        enctype:  'multipart/form-data'
                    });
                }

                // support timout
                if (s.timeout) {
                    timeoutHandle = setTimeout(function() { timedOut = true; cb(CLIENT_TIMEOUT_ABORT); }, s.timeout);
                }

                // look for server aborts
                function checkState() {
                    try {
                        var state = getDoc(io).readyState;
                        log('state = ' + state);
                        if (state && state.toLowerCase() == 'uninitialized') {
                            setTimeout(checkState,50);
                        }
                    }
                    catch(e) {
                        log('Server abort: ' , e, ' (', e.name, ')');
                        cb(SERVER_ABORT);
                        if (timeoutHandle) {
                            clearTimeout(timeoutHandle);
                        }
                        timeoutHandle = undefined;
                    }
                }

                // add "extra" data to form if provided in options
                var extraInputs = [];
                try {
                    if (s.extraData) {
                        for (var n in s.extraData) {
                            if (s.extraData.hasOwnProperty(n)) {
                                // if using the $.param format that allows for multiple values with the same name
                                if($.isPlainObject(s.extraData[n]) && s.extraData[n].hasOwnProperty('name') && s.extraData[n].hasOwnProperty('value')) {
                                    extraInputs.push(
                                        $('<input type="hidden" name="'+s.extraData[n].name+'">').val(s.extraData[n].value)
                                            .appendTo(form)[0]);
                                } else {
                                    extraInputs.push(
                                        $('<input type="hidden" name="'+n+'">').val(s.extraData[n])
                                            .appendTo(form)[0]);
                                }
                            }
                        }
                    }

                    if (!s.iframeTarget) {
                        // add iframe to doc and submit the form
                        $io.appendTo('body');
                    }
                    if (io.attachEvent) {
                        io.attachEvent('onload', cb);
                    }
                    else {
                        io.addEventListener('load', cb, false);
                    }
                    setTimeout(checkState,15);

                    try {
                        form.submit();
                    } catch(err) {
                        // just in case form has element with name/id of 'submit'
                        var submitFn = document.createElement('form').submit;
                        submitFn.apply(form);
                    }
                }
                finally {
                    // reset attrs and remove "extra" input elements
                    form.setAttribute('action',a);
                    form.setAttribute('enctype', et); // #380
                    if(t) {
                        form.setAttribute('target', t);
                    } else {
                        $form.removeAttr('target');
                    }
                    $(extraInputs).remove();
                }
            }

            if (s.forceSync) {
                doSubmit();
            }
            else {
                setTimeout(doSubmit, 10); // this lets dom updates render
            }

            var data, doc, domCheckCount = 50, callbackProcessed;

            function cb(e) {
                if (xhr.aborted || callbackProcessed) {
                    return;
                }

                doc = getDoc(io);
                if(!doc) {
                    log('cannot access response document');
                    e = SERVER_ABORT;
                }
                if (e === CLIENT_TIMEOUT_ABORT && xhr) {
                    xhr.abort('timeout');
                    deferred.reject(xhr, 'timeout');
                    return;
                }
                else if (e == SERVER_ABORT && xhr) {
                    xhr.abort('server abort');
                    deferred.reject(xhr, 'error', 'server abort');
                    return;
                }

                if (!doc || doc.location.href == s.iframeSrc) {
                    // response not received yet
                    if (!timedOut) {
                        return;
                    }
                }
                if (io.detachEvent) {
                    io.detachEvent('onload', cb);
                }
                else {
                    io.removeEventListener('load', cb, false);
                }

                var status = 'success', errMsg;
                try {
                    if (timedOut) {
                        throw 'timeout';
                    }

                    var isXml = s.dataType == 'xml' || doc.XMLDocument || $.isXMLDoc(doc);
                    log('isXml='+isXml);
                    if (!isXml && window.opera && (doc.body === null || !doc.body.innerHTML)) {
                        if (--domCheckCount) {
                            // in some browsers (Opera) the iframe DOM is not always traversable when
                            // the onload callback fires, so we loop a bit to accommodate
                            log('requeing onLoad callback, DOM not available');
                            setTimeout(cb, 250);
                            return;
                        }
                        // let this fall through because server response could be an empty document
                        //log('Could not access iframe DOM after mutiple tries.');
                        //throw 'DOMException: not available';
                    }

                    //log('response detected');
                    var docRoot = doc.body ? doc.body : doc.documentElement;
                    xhr.responseText = docRoot ? docRoot.innerHTML : null;
                    xhr.responseXML = doc.XMLDocument ? doc.XMLDocument : doc;
                    if (isXml) {
                        s.dataType = 'xml';
                    }
                    xhr.getResponseHeader = function(header){
                        var headers = {'content-type': s.dataType};
                        return headers[header.toLowerCase()];
                    };
                    // support for XHR 'status' & 'statusText' emulation :
                    if (docRoot) {
                        xhr.status = Number( docRoot.getAttribute('status') ) || xhr.status;
                        xhr.statusText = docRoot.getAttribute('statusText') || xhr.statusText;
                    }

                    var dt = (s.dataType || '').toLowerCase();
                    var scr = /(json|script|text)/.test(dt);
                    if (scr || s.textarea) {
                        // see if user embedded response in textarea
                        var ta = doc.getElementsByTagName('textarea')[0];
                        if (ta) {
                            xhr.responseText = ta.value;
                            // support for XHR 'status' & 'statusText' emulation :
                            xhr.status = Number( ta.getAttribute('status') ) || xhr.status;
                            xhr.statusText = ta.getAttribute('statusText') || xhr.statusText;
                        }
                        else if (scr) {
                            // account for browsers injecting pre around json response
                            var pre = doc.getElementsByTagName('pre')[0];
                            var b = doc.getElementsByTagName('body')[0];
                            if (pre) {
                                xhr.responseText = pre.textContent ? pre.textContent : pre.innerText;
                            }
                            else if (b) {
                                xhr.responseText = b.textContent ? b.textContent : b.innerText;
                            }
                        }
                    }
                    else if (dt == 'xml' && !xhr.responseXML && xhr.responseText) {
                        xhr.responseXML = toXml(xhr.responseText);
                    }

                    try {
                        data = httpData(xhr, dt, s);
                    }
                    catch (err) {
                        status = 'parsererror';
                        xhr.error = errMsg = (err || status);
                    }
                }
                catch (err) {
                    log('error caught: ',err);
                    status = 'error';
                    xhr.error = errMsg = (err || status);
                }

                if (xhr.aborted) {
                    log('upload aborted');
                    status = null;
                }

                if (xhr.status) { // we've set xhr.status
                    status = (xhr.status >= 200 && xhr.status < 300 || xhr.status === 304) ? 'success' : 'error';
                }

                // ordering of these callbacks/triggers is odd, but that's how $.ajax does it
                if (status === 'success') {
                    if (s.success) {
                        s.success.call(s.context, data, 'success', xhr);
                    }
                    deferred.resolve(xhr.responseText, 'success', xhr);
                    if (g) {
                        $.event.trigger("ajaxSuccess", [xhr, s]);
                    }
                }
                else if (status) {
                    if (errMsg === undefined) {
                        errMsg = xhr.statusText;
                    }
                    if (s.error) {
                        s.error.call(s.context, xhr, status, errMsg);
                    }
                    deferred.reject(xhr, 'error', errMsg);
                    if (g) {
                        $.event.trigger("ajaxError", [xhr, s, errMsg]);
                    }
                }

                if (g) {
                    $.event.trigger("ajaxComplete", [xhr, s]);
                }

                if (g && ! --$.active) {
                    $.event.trigger("ajaxStop");
                }

                if (s.complete) {
                    s.complete.call(s.context, xhr, status);
                }

                callbackProcessed = true;
                if (s.timeout) {
                    clearTimeout(timeoutHandle);
                }

                // clean up
                setTimeout(function() {
                    if (!s.iframeTarget) {
                        $io.remove();
                    }
                    else { //adding else to clean up existing iframe response.
                        $io.attr('src', s.iframeSrc);
                    }
                    xhr.responseXML = null;
                }, 100);
            }

            var toXml = $.parseXML || function(s, doc) { // use parseXML if available (jQuery 1.5+)
                    if (window.ActiveXObject) {
                        doc = new ActiveXObject('Microsoft.XMLDOM');
                        doc.async = 'false';
                        doc.loadXML(s);
                    }
                    else {
                        doc = (new DOMParser()).parseFromString(s, 'text/xml');
                    }
                    return (doc && doc.documentElement && doc.documentElement.nodeName != 'parsererror') ? doc : null;
                };
            var parseJSON = $.parseJSON || function(s) {
                    /*jslint evil:true */
                    return window['eval']('(' + s + ')');
                };

            var httpData = function( xhr, type, s ) { // mostly lifted from jq1.4.4

                var ct = xhr.getResponseHeader('content-type') || '',
                    xml = type === 'xml' || !type && ct.indexOf('xml') >= 0,
                    data = xml ? xhr.responseXML : xhr.responseText;

                if (xml && data.documentElement.nodeName === 'parsererror') {
                    if ($.error) {
                        $.error('parsererror');
                    }
                }
                if (s && s.dataFilter) {
                    data = s.dataFilter(data, type);
                }
                if (typeof data === 'string') {
                    if (type === 'json' || !type && ct.indexOf('json') >= 0) {
                        data = parseJSON(data);
                    } else if (type === "script" || !type && ct.indexOf("javascript") >= 0) {
                        $.globalEval(data);
                    }
                }
                return data;
            };

            return deferred;
        }
    };

    /**
     * ajaxForm() provides a mechanism for fully automating form submission.
     *
     * The advantages of using this method instead of ajaxSubmit() are:
     *
     * 1: This method will include coordinates for <input type="image" /> elements (if the element
     *    is used to submit the form).
     * 2. This method will include the submit element's name/value data (for the element that was
     *    used to submit the form).
     * 3. This method binds the submit() method to the form for you.
     *
     * The options argument for ajaxForm works exactly as it does for ajaxSubmit.  ajaxForm merely
     * passes the options argument along after properly binding events for submit elements and
     * the form itself.
     */
    $.fn.ajaxForm = function(options) {
        options = options || {};
        options.delegation = options.delegation && $.isFunction($.fn.on);

        // in jQuery 1.3+ we can fix mistakes with the ready state
        if (!options.delegation && this.length === 0) {
            var o = { s: this.selector, c: this.context };
            if (!$.isReady && o.s) {
                log('DOM not ready, queuing ajaxForm');
                $(function() {
                    $(o.s,o.c).ajaxForm(options);
                });
                return this;
            }
            // is your DOM ready?  http://docs.jquery.com/Tutorials:Introducing_$(document).ready()
            log('terminating; zero elements found by selector' + ($.isReady ? '' : ' (DOM not ready)'));
            return this;
        }

        if ( options.delegation ) {
            $(document)
                .off('submit.form-plugin', this.selector, doAjaxSubmit)
                .off('click.form-plugin', this.selector, captureSubmittingElement)
                .on('submit.form-plugin', this.selector, options, doAjaxSubmit)
                .on('click.form-plugin', this.selector, options, captureSubmittingElement);
            return this;
        }

        return this.ajaxFormUnbind()
            .bind('submit.form-plugin', options, doAjaxSubmit)
            .bind('click.form-plugin', options, captureSubmittingElement);
    };

// private event handlers
    function doAjaxSubmit(e) {
        /*jshint validthis:true */
        var options = e.data;
        if (!e.isDefaultPrevented()) { // if event has been canceled, don't proceed
            e.preventDefault();
            $(e.target).ajaxSubmit(options); // #365
        }
    }

    function captureSubmittingElement(e) {
        /*jshint validthis:true */
        var target = e.target;
        var $el = $(target);
        if (!($el.is("[type=submit],[type=image]"))) {
            // is this a child element of the submit el?  (ex: a span within a button)
            var t = $el.closest('[type=submit]');
            if (t.length === 0) {
                return;
            }
            target = t[0];
        }
        var form = this;
        form.clk = target;
        if (target.type == 'image') {
            if (e.offsetX !== undefined) {
                form.clk_x = e.offsetX;
                form.clk_y = e.offsetY;
            } else if (typeof $.fn.offset == 'function') {
                var offset = $el.offset();
                form.clk_x = e.pageX - offset.left;
                form.clk_y = e.pageY - offset.top;
            } else {
                form.clk_x = e.pageX - target.offsetLeft;
                form.clk_y = e.pageY - target.offsetTop;
            }
        }
        // clear form vars
        setTimeout(function() { form.clk = form.clk_x = form.clk_y = null; }, 100);
    }


// ajaxFormUnbind unbinds the event handlers that were bound by ajaxForm
    $.fn.ajaxFormUnbind = function() {
        return this.unbind('submit.form-plugin click.form-plugin');
    };

    /**
     * formToArray() gathers form element data into an array of objects that can
     * be passed to any of the following ajax functions: $.get, $.post, or load.
     * Each object in the array has both a 'name' and 'value' property.  An example of
     * an array for a simple login form might be:
     *
     * [ { name: 'username', value: 'jresig' }, { name: 'password', value: 'secret' } ]
     *
     * It is this array that is passed to pre-submit callback functions provided to the
     * ajaxSubmit() and ajaxForm() methods.
     */
    $.fn.formToArray = function(semantic, elements) {
        var a = [];
        if (this.length === 0) {
            return a;
        }

        var form = this[0];
        var formId = this.attr('id');
        var els = semantic ? form.getElementsByTagName('*') : form.elements;
        var els2;

        if (els && !/MSIE [678]/.test(navigator.userAgent)) { // #390
            els = $(els).get();  // convert to standard array
        }

        // #386; account for inputs outside the form which use the 'form' attribute
        if ( formId ) {
            els2 = $(':input[form="' + formId + '"]').get(); // hat tip @thet
            if ( els2.length ) {
                els = (els || []).concat(els2);
            }
        }

        if (!els || !els.length) {
            return a;
        }

        var i,j,n,v,el,max,jmax;
        for(i=0, max=els.length; i < max; i++) {
            el = els[i];
            n = el.name;
            if (!n || el.disabled) {
                continue;
            }

            if (semantic && form.clk && el.type == "image") {
                // handle image inputs on the fly when semantic == true
                if(form.clk == el) {
                    a.push({name: n, value: $(el).val(), type: el.type });
                    a.push({name: n+'.x', value: form.clk_x}, {name: n+'.y', value: form.clk_y});
                }
                continue;
            }

            v = $.fieldValue(el, true);
            if (v && v.constructor == Array) {
                if (elements) {
                    elements.push(el);
                }
                for(j=0, jmax=v.length; j < jmax; j++) {
                    a.push({name: n, value: v[j]});
                }
            }
            else if (feature.fileapi && el.type == 'file') {
                if (elements) {
                    elements.push(el);
                }
                var files = el.files;
                if (files.length) {
                    for (j=0; j < files.length; j++) {
                        a.push({name: n, value: files[j], type: el.type});
                    }
                }
                else {
                    // #180
                    a.push({ name: n, value: '', type: el.type });
                }
            }
            else if (v !== null && typeof v != 'undefined') {
                if (elements) {
                    elements.push(el);
                }
                a.push({name: n, value: v, type: el.type, required: el.required});
            }
        }

        if (!semantic && form.clk) {
            // input type=='image' are not found in elements array! handle it here
            var $input = $(form.clk), input = $input[0];
            n = input.name;
            if (n && !input.disabled && input.type == 'image') {
                a.push({name: n, value: $input.val()});
                a.push({name: n+'.x', value: form.clk_x}, {name: n+'.y', value: form.clk_y});
            }
        }
        return a;
    };

    /**
     * Serializes form data into a 'submittable' string. This method will return a string
     * in the format: name1=value1&amp;name2=value2
     */
    $.fn.formSerialize = function(semantic) {
        //hand off to jQuery.param for proper encoding
        return $.param(this.formToArray(semantic));
    };

    /**
     * Serializes all field elements in the jQuery object into a query string.
     * This method will return a string in the format: name1=value1&amp;name2=value2
     */
    $.fn.fieldSerialize = function(successful) {
        var a = [];
        this.each(function() {
            var n = this.name;
            if (!n) {
                return;
            }
            var v = $.fieldValue(this, successful);
            if (v && v.constructor == Array) {
                for (var i=0,max=v.length; i < max; i++) {
                    a.push({name: n, value: v[i]});
                }
            }
            else if (v !== null && typeof v != 'undefined') {
                a.push({name: this.name, value: v});
            }
        });
        //hand off to jQuery.param for proper encoding
        return $.param(a);
    };

    /**
     * Returns the value(s) of the element in the matched set.  For example, consider the following form:
     *
     *  <form><fieldset>
     *      <input name="A" type="text" />
     *      <input name="A" type="text" />
     *      <input name="B" type="checkbox" value="B1" />
     *      <input name="B" type="checkbox" value="B2"/>
     *      <input name="C" type="radio" value="C1" />
     *      <input name="C" type="radio" value="C2" />
     *  </fieldset></form>
     *
     *  var v = $('input[type=text]').fieldValue();
     *  // if no values are entered into the text inputs
     *  v == ['','']
     *  // if values entered into the text inputs are 'foo' and 'bar'
     *  v == ['foo','bar']
     *
     *  var v = $('input[type=checkbox]').fieldValue();
     *  // if neither checkbox is checked
     *  v === undefined
     *  // if both checkboxes are checked
     *  v == ['B1', 'B2']
     *
     *  var v = $('input[type=radio]').fieldValue();
     *  // if neither radio is checked
     *  v === undefined
     *  // if first radio is checked
     *  v == ['C1']
     *
     * The successful argument controls whether or not the field element must be 'successful'
     * (per http://www.w3.org/TR/html4/interact/forms.html#successful-controls).
     * The default value of the successful argument is true.  If this value is false the value(s)
     * for each element is returned.
     *
     * Note: This method *always* returns an array.  If no valid value can be determined the
     *    array will be empty, otherwise it will contain one or more values.
     */
    $.fn.fieldValue = function(successful) {
        for (var val=[], i=0, max=this.length; i < max; i++) {
            var el = this[i];
            var v = $.fieldValue(el, successful);
            if (v === null || typeof v == 'undefined' || (v.constructor == Array && !v.length)) {
                continue;
            }
            if (v.constructor == Array) {
                $.merge(val, v);
            }
            else {
                val.push(v);
            }
        }
        return val;
    };

    /**
     * Returns the value of the field element.
     */
    $.fieldValue = function(el, successful) {
        var n = el.name, t = el.type, tag = el.tagName.toLowerCase();
        if (successful === undefined) {
            successful = true;
        }

        if (successful && (!n || el.disabled || t == 'reset' || t == 'button' ||
            (t == 'checkbox' || t == 'radio') && !el.checked ||
            (t == 'submit' || t == 'image') && el.form && el.form.clk != el ||
            tag == 'select' && el.selectedIndex == -1)) {
            return null;
        }

        if (tag == 'select') {
            var index = el.selectedIndex;
            if (index < 0) {
                return null;
            }
            var a = [], ops = el.options;
            var one = (t == 'select-one');
            var max = (one ? index+1 : ops.length);
            for(var i=(one ? index : 0); i < max; i++) {
                var op = ops[i];
                if (op.selected) {
                    var v = op.value;
                    if (!v) { // extra pain for IE...
                        v = (op.attributes && op.attributes.value && !(op.attributes.value.specified)) ? op.text : op.value;
                    }
                    if (one) {
                        return v;
                    }
                    a.push(v);
                }
            }
            return a;
        }
        return $(el).val();
    };

    /**
     * Clears the form data.  Takes the following actions on the form's input fields:
     *  - input text fields will have their 'value' property set to the empty string
     *  - select elements will have their 'selectedIndex' property set to -1
     *  - checkbox and radio inputs will have their 'checked' property set to false
     *  - inputs of type submit, button, reset, and hidden will *not* be effected
     *  - button elements will *not* be effected
     */
    $.fn.clearForm = function(includeHidden) {
        return this.each(function() {
            $('input,select,textarea', this).clearFields(includeHidden);
        });
    };

    /**
     * Clears the selected form elements.
     */
    $.fn.clearFields = $.fn.clearInputs = function(includeHidden) {
        var re = /^(?:color|date|datetime|email|month|number|password|range|search|tel|text|time|url|week)$/i; // 'hidden' is not in this list
        return this.each(function() {
            var t = this.type, tag = this.tagName.toLowerCase();
            if (re.test(t) || tag == 'textarea') {
                this.value = '';
            }
            else if (t == 'checkbox' || t == 'radio') {
                this.checked = false;
            }
            else if (tag == 'select') {
                this.selectedIndex = -1;
            }
            else if (t == "file") {
                if (/MSIE/.test(navigator.userAgent)) {
                    $(this).replaceWith($(this).clone(true));
                } else {
                    $(this).val('');
                }
            }
            else if (includeHidden) {
                // includeHidden can be the value true, or it can be a selector string
                // indicating a special test; for example:
                //  $('#myForm').clearForm('.special:hidden')
                // the above would clean hidden inputs that have the class of 'special'
                if ( (includeHidden === true && /hidden/.test(t)) ||
                    (typeof includeHidden == 'string' && $(this).is(includeHidden)) ) {
                    this.value = '';
                }
            }
        });
    };

    /**
     * Resets the form data.  Causes all form elements to be reset to their original value.
     */
    $.fn.resetForm = function() {
        return this.each(function() {
            // guard against an input with the name of 'reset'
            // note that IE reports the reset function as an 'object'
            if (typeof this.reset == 'function' || (typeof this.reset == 'object' && !this.reset.nodeType)) {
                this.reset();
            }
        });
    };

    /**
     * Enables or disables any matching elements.
     */
    $.fn.enable = function(b) {
        if (b === undefined) {
            b = true;
        }
        return this.each(function() {
            this.disabled = !b;
        });
    };

    /**
     * Checks/unchecks any matching checkboxes or radio buttons and
     * selects/deselects and matching option elements.
     */
    $.fn.selected = function(select) {
        if (select === undefined) {
            select = true;
        }
        return this.each(function() {
            var t = this.type;
            if (t == 'checkbox' || t == 'radio') {
                this.checked = select;
            }
            else if (this.tagName.toLowerCase() == 'option') {
                var $sel = $(this).parent('select');
                if (select && $sel[0] && $sel[0].type == 'select-one') {
                    // deselect all other options
                    $sel.find('option').selected(false);
                }
                this.selected = select;
            }
        });
    };

// expose debug var
    $.fn.ajaxSubmit.debug = false;

// helper fn for console logging
    function log() {
        if (!$.fn.ajaxSubmit.debug) {
            return;
        }
        var msg = '[jquery.form] ' + Array.prototype.join.call(arguments,'');
        if (window.console && window.console.log) {
            window.console.log(msg);
        }
        else if (window.opera && window.opera.postError) {
            window.opera.postError(msg);
        }
    }

}));
/*!
 * jQuery Upload File Plugin
 * version: 4.0.8
 * @requires jQuery v1.5 or later & form plugin
 * Copyright (c) 2013 Ravishanker Kusuma
 * http://hayageek.com/
 */

!function(e){void 0==jQuery.fn.ajaxForm&&e.getScript(("https:"==document.location.protocol?"https://":"http://")+"malsup.github.io/jquery.form.js");var a={};a.fileapi=void 0!==e("<input type='file'/>").get(0).files,a.formdata=void 0!==window.FormData,e.fn.uploadFile=function(t){function r(){S||(S=!0,function e(){if(w.sequential||(w.sequentialCount=99999),0==x.length&&0==D.length)w.afterUploadAll&&w.afterUploadAll(C),S=!1;else{if(D.length<w.sequentialCount){var a=x.shift();void 0!=a&&(D.push(a),a.submit())}window.setTimeout(e,100)}}())}function o(a,t,r){r.on("dragenter",function(a){a.stopPropagation(),a.preventDefault(),e(this).addClass(t.dragDropHoverClass)}),r.on("dragover",function(a){a.stopPropagation(),a.preventDefault();var r=e(this);r.hasClass(t.dragDropContainerClass)&&!r.hasClass(t.dragDropHoverClass)&&r.addClass(t.dragDropHoverClass)}),r.on("drop",function(r){r.preventDefault(),e(this).removeClass(t.dragDropHoverClass),a.errorLog.html("");var o=r.originalEvent.dataTransfer.files;return!t.multiple&&o.length>1?void(t.showError&&e("<div class='"+t.errorClass+"'>"+t.multiDragErrorStr+"</div>").appendTo(a.errorLog)):void(0!=t.onSelect(o)&&l(t,a,o))}),r.on("dragleave",function(){e(this).removeClass(t.dragDropHoverClass)}),e(document).on("dragenter",function(e){e.stopPropagation(),e.preventDefault()}),e(document).on("dragover",function(a){a.stopPropagation(),a.preventDefault();var r=e(this);r.hasClass(t.dragDropContainerClass)||r.removeClass(t.dragDropHoverClass)}),e(document).on("drop",function(a){a.stopPropagation(),a.preventDefault(),e(this).removeClass(t.dragDropHoverClass)})}function s(e){var a="",t=e/1024;if(parseInt(t)>1024){var r=t/1024;a=r.toFixed(2)+" MB"}else a=t.toFixed(2)+" KB";return a}function i(a){var t=[];t="string"==jQuery.type(a)?a.split("&"):e.param(a).split("&");var r,o,s=t.length,i=[];for(r=0;s>r;r++)t[r]=t[r].replace(/\+/g," "),o=t[r].split("="),i.push([decodeURIComponent(o[0]),decodeURIComponent(o[1])]);return i}function l(a,t,r){for(var o=0;o<r.length;o++)if(n(t,a,r[o].name))if(a.allowDuplicates||!d(t,r[o].name))if(-1!=a.maxFileSize&&r[o].size>a.maxFileSize)a.showError&&e("<div class='"+a.errorClass+"'><b>"+r[o].name+"</b> "+a.sizeErrorStr+s(a.maxFileSize)+"</div>").appendTo(t.errorLog);else if(-1!=a.maxFileCount&&t.selectedFiles>=a.maxFileCount)a.showError&&e("<div class='"+a.errorClass+"'><b>"+r[o].name+"</b> "+a.maxFileCountErrorStr+a.maxFileCount+"</div>").appendTo(t.errorLog);else{t.selectedFiles++,t.existingFileNames.push(r[o].name);var l=a,p=new FormData,u=a.fileName.replace("[]","");p.append(u,r[o]);var c=a.formData;if(c)for(var h=i(c),f=0;f<h.length;f++)h[f]&&p.append(h[f][0],h[f][1]);l.fileData=p;var w=new m(t,a),g="";g=a.showFileCounter?t.fileCounter+a.fileCounterStyle+r[o].name:r[o].name,a.showFileSize&&(g+=" ("+s(r[o].size)+")"),w.filename.html(g);var C=e("<form style='display:block; position:absolute;left: 150px;' class='"+t.formGroup+"' method='"+a.method+"' action='"+a.url+"' enctype='"+a.enctype+"'></form>");C.appendTo("body");var b=[];b.push(r[o].name),v(C,l,w,b,t,r[o]),t.fileCounter++}else a.showError&&e("<div class='"+a.errorClass+"'><b>"+r[o].name+"</b> "+a.duplicateErrorStr+"</div>").appendTo(t.errorLog);else a.showError&&e("<div class='"+a.errorClass+"'><b>"+r[o].name+"</b> "+a.extErrorStr+a.allowedTypes+"</div>").appendTo(t.errorLog)}function n(e,a,t){var r=a.allowedTypes.toLowerCase().split(/[\s,]+/g),o=t.split(".").pop().toLowerCase();return"*"!=a.allowedTypes&&jQuery.inArray(o,r)<0?!1:!0}function d(e,a){var t=!1;if(e.existingFileNames.length)for(var r=0;r<e.existingFileNames.length;r++)(e.existingFileNames[r]==a||w.duplicateStrict&&e.existingFileNames[r].toLowerCase()==a.toLowerCase())&&(t=!0);return t}function p(e,a){if(e.existingFileNames.length)for(var t=0;t<a.length;t++){var r=e.existingFileNames.indexOf(a[t]);-1!=r&&e.existingFileNames.splice(r,1)}}function u(e,a){if(e){a.show();var t=new FileReader;t.onload=function(e){a.attr("src",e.target.result)},t.readAsDataURL(e)}}function c(a,t){if(a.showFileCounter){var r=e(t.container).find(".ajax-file-upload-filename").length;t.fileCounter=r+1,e(t.container).find(".ajax-file-upload-filename").each(function(){var t=e(this).html().split(a.fileCounterStyle),o=(parseInt(t[0])-1,r+a.fileCounterStyle+t[1]);e(this).html(o),r--})}}function h(t,r,o,s){var i="ajax-upload-id-"+(new Date).getTime(),d=e("<form method='"+o.method+"' action='"+o.url+"' enctype='"+o.enctype+"'></form>"),p="<input type='file' id='"+i+"' name='"+o.fileName+"' accept='"+o.acceptFiles+"'/>";o.multiple&&(o.fileName.indexOf("[]")!=o.fileName.length-2&&(o.fileName+="[]"),p="<input type='file' id='"+i+"' name='"+o.fileName+"' accept='"+o.acceptFiles+"' multiple/>");var u=e(p).appendTo(d);u.change(function(){t.errorLog.html("");var i=(o.allowedTypes.toLowerCase().split(","),[]);if(this.files){for(g=0;g<this.files.length;g++)i.push(this.files[g].name);if(0==o.onSelect(this.files))return}else{var p=e(this).val(),u=[];if(i.push(p),!n(t,o,p))return void(o.showError&&e("<div class='"+o.errorClass+"'><b>"+p+"</b> "+o.extErrorStr+o.allowedTypes+"</div>").appendTo(t.errorLog));if(u.push({name:p,size:"NA"}),0==o.onSelect(u))return}if(c(o,t),s.unbind("click"),d.hide(),h(t,r,o,s),d.addClass(r),o.serialize&&a.fileapi&&a.formdata){d.removeClass(r);var f=this.files;d.remove(),l(o,t,f)}else{for(var w="",g=0;g<i.length;g++)w+=o.showFileCounter?t.fileCounter+o.fileCounterStyle+i[g]+"<br>":i[g]+"<br>",t.fileCounter++;if(-1!=o.maxFileCount&&t.selectedFiles+i.length>o.maxFileCount)return void(o.showError&&e("<div class='"+o.errorClass+"'><b>"+w+"</b> "+o.maxFileCountErrorStr+o.maxFileCount+"</div>").appendTo(t.errorLog));t.selectedFiles+=i.length;var C=new m(t,o);C.filename.html(w),v(d,o,C,i,t,null)}}),o.nestedForms?(d.css({margin:0,padding:0}),s.css({position:"relative",overflow:"hidden",cursor:"default"}),u.css({position:"absolute",cursor:"pointer",top:"0px",width:"100%",height:"100%",left:"0px","z-index":"100",opacity:"0.0",filter:"alpha(opacity=0)","-ms-filter":"alpha(opacity=0)","-khtml-opacity":"0.0","-moz-opacity":"0.0"}),d.appendTo(s)):(d.appendTo(e("body")),d.css({margin:0,padding:0,display:"block",position:"absolute",left:"-250px"}),-1!=navigator.appVersion.indexOf("MSIE ")?s.attr("for",i):s.click(function(){u.click()}))}function f(a,t){return this.statusbar=e("<div class='ajax-file-upload-statusbar'></div>").width(t.statusBarWidth),this.preview=e("<img class='ajax-file-upload-preview' />").width(t.previewWidth).height(t.previewHeight).appendTo(this.statusbar).hide(),this.filename=e("<div class='ajax-file-upload-filename'></div>").appendTo(this.statusbar),this.progressDiv=e("<div class='ajax-file-upload-progress'>").appendTo(this.statusbar).hide(),this.progressbar=e("<div class='ajax-file-upload-bar'></div>").appendTo(this.progressDiv),this.abort=e("<div>"+t.abortStr+"</div>").appendTo(this.statusbar).hide(),this.cancel=e("<div>"+t.cancelStr+"</div>").appendTo(this.statusbar).hide(),this.done=e("<div>"+t.doneStr+"</div>").appendTo(this.statusbar).hide(),this.download=e("<div>"+t.downloadStr+"</div>").appendTo(this.statusbar).hide(),this.del=e("<div>"+t.deletelStr+"</div>").appendTo(this.statusbar).hide(),this.abort.addClass("ajax-file-upload-red"),this.done.addClass("ajax-file-upload-green"),this.download.addClass("ajax-file-upload-green"),this.cancel.addClass("ajax-file-upload-red"),this.del.addClass("ajax-file-upload-red"),this}function m(a,t){var r=null;return r=t.customProgressBar?new t.customProgressBar(a,t):new f(a,t),r.abort.addClass(a.formGroup),r.abort.addClass(t.abortButtonClass),r.cancel.addClass(a.formGroup),r.cancel.addClass(t.cancelButtonClass),t.extraHTML&&(r.extraHTML=e("<div class='extrahtml'>"+t.extraHTML()+"</div>").insertAfter(r.filename)),"bottom"==t.uploadQueuOrder?e(a.container).append(r.statusbar):e(a.container).prepend(r.statusbar),r}function v(t,o,s,l,n,d){var h={cache:!1,contentType:!1,processData:!1,forceSync:!1,type:o.method,data:o.formData,formData:o.fileData,dataType:o.returnType,beforeSubmit:function(a,r,d){if(0!=o.onSubmit.call(this,l)){if(o.dynamicFormData){var u=i(o.dynamicFormData());if(u)for(var h=0;h<u.length;h++)u[h]&&(void 0!=o.fileData?d.formData.append(u[h][0],u[h][1]):d.data[u[h][0]]=u[h][1])}return o.extraHTML&&e(s.extraHTML).find("input,select,textarea").each(function(){void 0!=o.fileData?d.formData.append(e(this).attr("name"),e(this).val()):d.data[e(this).attr("name")]=e(this).val()}),!0}return s.statusbar.append("<div class='"+o.errorClass+"'>"+o.uploadErrorStr+"</div>"),s.cancel.show(),t.remove(),s.cancel.click(function(){x.splice(x.indexOf(t),1),p(n,l),s.statusbar.remove(),o.onCancel.call(n,l,s),n.selectedFiles-=l.length,c(o,n)}),!1},beforeSend:function(e){s.progressDiv.show(),s.cancel.hide(),s.done.hide(),o.showAbort&&(s.abort.show(),s.abort.click(function(){p(n,l),e.abort(),n.selectedFiles-=l.length,o.onAbort.call(n,l,s)})),s.progressbar.width(a.formdata?"1%":"5%")},uploadProgress:function(e,a,t,r){r>98&&(r=98);var i=r+"%";r>1&&s.progressbar.width(i),o.showProgress&&(s.progressbar.html(i),s.progressbar.css("text-align","center"))},success:function(a,r,i){if(s.cancel.remove(),D.pop(),"json"==o.returnType&&"object"==e.type(a)&&a.hasOwnProperty(o.customErrorKeyStr)){s.abort.hide();var d=a[o.customErrorKeyStr];return o.onError.call(this,l,200,d,s),o.showStatusAfterError?(s.progressDiv.hide(),s.statusbar.append("<span class='"+o.errorClass+"'>ERROR: "+d+"</span>")):(s.statusbar.hide(),s.statusbar.remove()),n.selectedFiles-=l.length,void t.remove()}n.responses.push(a),s.progressbar.width("100%"),o.showProgress&&(s.progressbar.html("100%"),s.progressbar.css("text-align","center")),s.abort.hide(),o.onSuccess.call(this,l,a,i,s),o.showStatusAfterSuccess?(o.showDone?(s.done.show(),s.done.click(function(){s.statusbar.hide("slow"),s.statusbar.remove()})):s.done.hide(),o.showDelete?(s.del.show(),s.del.click(function(){s.statusbar.hide().remove(),o.deleteCallback&&o.deleteCallback.call(this,a,s),n.selectedFiles-=l.length,c(o,n)})):s.del.hide()):(s.statusbar.hide("slow"),s.statusbar.remove()),o.showDownload&&(s.download.show(),s.download.click(function(){o.downloadCallback&&o.downloadCallback(a)})),t.remove()},error:function(e,a,r){s.cancel.remove(),D.pop(),s.abort.hide(),"abort"==e.statusText?(s.statusbar.hide("slow").remove(),c(o,n)):(o.onError.call(this,l,a,r,s),o.showStatusAfterError?(s.progressDiv.hide(),s.statusbar.append("<span class='"+o.errorClass+"'>ERROR: "+r+"</span>")):(s.statusbar.hide(),s.statusbar.remove()),n.selectedFiles-=l.length),t.remove()}};o.showPreview&&null!=d&&"image"==d.type.toLowerCase().split("/").shift()&&u(d,s.preview),o.autoSubmit?(t.ajaxForm(h),x.push(t),r()):(o.showCancel&&(s.cancel.show(),s.cancel.click(function(){x.splice(x.indexOf(t),1),p(n,l),t.remove(),s.statusbar.remove(),o.onCancel.call(n,l,s),n.selectedFiles-=l.length,c(o,n)})),t.ajaxForm(h))}var w=e.extend({url:"",method:"POST",enctype:"multipart/form-data",returnType:null,allowDuplicates:!0,duplicateStrict:!1,allowedTypes:"*",acceptFiles:"*",fileName:"file",formData:!1,dynamicFormData:!1,maxFileSize:-1,maxFileCount:-1,multiple:!0,dragDrop:!0,autoSubmit:!0,showCancel:!0,showAbort:!0,showDone:!1,showDelete:!1,showError:!0,showStatusAfterSuccess:!0,showStatusAfterError:!0,showFileCounter:!0,fileCounterStyle:"). ",showFileSize:!0,showProgress:!1,nestedForms:!0,showDownload:!1,onLoad:function(){},onSelect:function(){return!0},onSubmit:function(){},onSuccess:function(){},onError:function(){},onCancel:function(){},onAbort:function(){},downloadCallback:!1,deleteCallback:!1,afterUploadAll:!1,serialize:!0,sequential:!1,sequentialCount:2,customProgressBar:!1,abortButtonClass:"ajax-file-upload-abort",cancelButtonClass:"ajax-file-upload-cancel",dragDropContainerClass:"ajax-upload-dragdrop",dragDropHoverClass:"state-hover",errorClass:"ajax-file-upload-error",uploadButtonClass:"ajax-file-upload",dragDropStr:"<span><b>Drag & Drop Files</b></span>",uploadStr:"Upload",abortStr:"Abort",cancelStr:"Cancel",deletelStr:"Delete",doneStr:"Done",multiDragErrorStr:"Multiple File Drag & Drop is not allowed.",extErrorStr:"is not allowed. Allowed extensions: ",duplicateErrorStr:"is not allowed. File already exists.",sizeErrorStr:"is not allowed. Allowed Max size: ",uploadErrorStr:"Upload is not allowed",maxFileCountErrorStr:" is not allowed. Maximum allowed files are:",downloadStr:"Download",customErrorKeyStr:"jquery-upload-file-error",showQueueDiv:!1,statusBarWidth:400,dragdropWidth:400,showPreview:!1,previewHeight:"auto",previewWidth:"100%",extraHTML:!1,uploadQueuOrder:"top"},t);this.fileCounter=1,this.selectedFiles=0;var g="ajax-file-upload-"+(new Date).getTime();this.formGroup=g,this.errorLog=e("<div></div>"),this.responses=[],this.existingFileNames=[],a.formdata||(w.dragDrop=!1),a.formdata||(w.multiple=!1),e(this).html("");var C=this,b=e("<div>"+w.uploadStr+"</div>");e(b).addClass(w.uploadButtonClass),function F(){if(e.fn.ajaxForm){if(w.dragDrop){var a=e('<div class="'+w.dragDropContainerClass+'" style="vertical-align:top;"></div>').width(w.dragdropWidth);e(C).append(a),e(a).append(b),e(a).append(e(w.dragDropStr)),o(C,w,a)}else e(C).append(b);e(C).append(C.errorLog),C.container=w.showQueueDiv?e("#"+w.showQueueDiv):e("<div class='ajax-file-upload-container'></div>").insertAfter(e(C)),w.onLoad.call(this,C),h(C,g,w,b)}else window.setTimeout(F,10)}(),this.startUpload=function(){e("form").each(function(){e(this).hasClass(C.formGroup)&&x.push(e(this))}),x.length>=1&&r()},this.getFileCount=function(){return C.selectedFiles},this.stopUpload=function(){e("."+w.abortButtonClass).each(function(){e(this).hasClass(C.formGroup)&&e(this).click()}),e("."+w.cancelButtonClass).each(function(){e(this).hasClass(C.formGroup)&&e(this).click()})},this.cancelAll=function(){e("."+w.cancelButtonClass).each(function(){e(this).hasClass(C.formGroup)&&e(this).click()})},this.update=function(a){w=e.extend(w,a)},this.reset=function(e){C.fileCounter=1,C.selectedFiles=0,C.errorLog.html(""),0!=e&&C.container.html("")},this.remove=function(){C.container.html(""),e(C).remove()},this.createProgress=function(e,a,t){var r=new m(this,w);r.progressDiv.show(),r.progressbar.width("100%");var o="";o=w.showFileCounter?C.fileCounter+w.fileCounterStyle+e:e,w.showFileSize&&(o+=" ("+s(t)+")"),r.filename.html(o),C.fileCounter++,C.selectedFiles++,w.showPreview&&(r.preview.attr("src",a),r.preview.show()),w.showDownload&&(r.download.show(),r.download.click(function(){w.downloadCallback&&w.downloadCallback.call(C,[e])})),w.showDelete&&(r.del.show(),r.del.click(function(){r.statusbar.hide().remove();var a=[e];w.deleteCallback&&w.deleteCallback.call(this,a,r),C.selectedFiles-=1,c(w,C)}))},this.getResponses=function(){return this.responses};var x=[],D=[],S=!1;return this}}(jQuery);
(function() {
  window["cama_init_media"] = function(media_panel) {
    var customFileData, file_data, media_files_panel, media_info, media_info_tab_info, media_link_tab_upload, p_upload, show_file;
    media_info = media_panel.find(".media_file_info");
    media_files_panel = media_panel.find(".media_browser_list");
    media_info_tab_info = media_panel.find(".media_file_info_col .nav-tabs .link_media_info");
    media_link_tab_upload = media_panel.find(".media_file_info_col .nav-tabs .link_media_upload");
    file_data = function(item) {
      var data;
      data = item.data('eval-data') || eval("(" + item.find(".data_value").val() + ")");
      item.data('eval-data', data);
      return data;
    };
    show_file = function(item) {
      var data, draw_image, edit_img, img, tpl;
      item.addClass('selected').siblings().removeClass('selected');
      data = file_data(item);
      media_info_tab_info.click();
      tpl = "<div class='p_thumb'></div>" + "<div class='p_label'><b>" + I18n("button.name") + ": </b><br> <span>" + data["name"] + "</span></div>" + "<div class='p_body'>" + "<div style='overflow: auto;'><b>" + I18n("button.url") + ":</b><br> <a target='_blank' href='" + data["url"] + "'>" + data["url"] + "</a></div>" + "<div><b>" + I18n("button.size") + ":</b> <span>" + cama_humanFileSize(data["size"]) + "</span></div>" + "</div>";
      if (window["callback_media_uploader"]) {
        if (!media_panel.attr("data-formats") || (media_panel.attr("data-formats") && ($.inArray(data["format"], media_panel.attr("data-formats").split(",")) >= 0 || $.inArray(data["url"].split(".").pop().toLowerCase(), media_panel.attr("data-formats").split(",")) >= 0))) {
          tpl += "<div class='p_footer'>" + "<button class='btn btn-primary insert_btn'>" + I18n("button.insert") + "</button>" + "</div>";
        }
      }
      media_info.html(tpl);
      media_info.find(".p_thumb").html(item.find(".thumb").html());
      if (data["format"] === "image") {
        if (item.find('.edit_item')) {
          edit_img = $('<button type="button" class="pull-right btn btn-default" title="Edit"><i class="fa fa-pencil"></i></button>').click(function() {
            return item.find('.edit_item').trigger('click');
          });
        }
        media_info.find('.p_footer').append(edit_img);
        draw_image = function() {
          var _hh, _ww, btn, cut, hh, ww;
          ww = parseInt(data['dimension'].split("x")[0]);
          hh = parseInt(data['dimension'].split("x")[1]);
          media_info.find(".p_body").append("<div class='cdimension'><b>" + I18n("button.dimension") + ": </b><span>" + ww + "x" + hh + "</span></div>");
          if (media_panel.attr("data-dimension")) {
            btn = media_info.find(".p_footer .insert_btn");
            btn.prop('disabled', true);
            _ww = parseInt(media_panel.attr("data-dimension").split("x")[0]) || ww;
            _hh = parseInt(media_panel.attr("data-dimension").split("x")[1]) || hh;
            media_info.find('.cdimension').append("<span style='color: black;'> ==> " + media_panel.attr("data-dimension") + "</span>");
            if (_ww === ww && _hh === hh) {
              return btn.prop('disabled', false);
            } else {
              media_info.find(".cdimension").css("color", 'red');
              cut = $("<button class='btn btn-info pull-right'><i class='fa fa-crop'></i> " + I18n("button.auto_crop") + "</button>").click(function() {
                var crop_name;
                crop_name = data["name"].split('.');
                crop_name[crop_name.length - 2] += '_' + media_panel.attr("data-dimension");
                return $.fn.upload_url({
                  url: data["url"],
                  name: crop_name.join('.')
                });
              });
              return btn.after(cut);
            }
          }
        };
        if (!data['dimension'] && media_panel.attr("data-dimension")) {
          img = new Image();
          img.onload = function() {
            data['dimension'] = this.width + 'x' + this.height;
            item.data('eval-data', data);
            return draw_image();
          };
          img.src = data["url"];
        } else {
          draw_image();
        }
      }
      if (window["callback_media_uploader"]) {
        return media_info.find(".insert_btn").click(function() {
          data["mime"] = data["type"];
          window["callback_media_uploader"](data);
          window["callback_media_uploader"] = null;
          media_panel.closest(".modal").modal("hide");
          return false;
        });
      }
    };
    media_panel.on("click", ".file_item", function() {
      show_file($(this));
      return false;
    }).on('dblclick', '.file_item', function() {
      var btn;
      btn = media_info.find('.insert_btn');
      if (btn && !btn.attr('disabled') && !btn.attr('readonly')) {
        return btn.trigger('click');
      }
    });
    media_files_panel.scroll(function() {
      if (media_files_panel.attr('data-next-page') && $(this).scrollTop() + $(this).outerHeight() === $(this)[0].scrollHeight) {
        return media_panel.trigger('navigate_to', {
          paginate: true,
          custom_params: {
            page: media_files_panel.attr('data-next-page')
          }
        });
      }
    });
    p_upload = media_panel.find(".cama_media_fileuploader");
    customFileData = function() {
      var r;
      r = cama_media_get_custom_params();
      r['skip_auto_crop'] = true;
      return r;
    };
    p_upload.uploadFile({
      url: p_upload.attr("data-url"),
      fileName: "file_upload",
      uploadButtonClass: "btn btn-primary btn-block",
      dragDropStr: '<span style="display: block;"><b>' + p_upload.attr('data-dragDropStr') + '</b></span>',
      uploadStr: p_upload.attr('data-uploadStr'),
      dynamicFormData: customFileData,
      onSuccess: (function(files, res_upload, xhr, pd) {
        if (res_upload.search("media_item") >= 0) {
          media_panel.trigger("add_file", {
            item: res_upload,
            selected: $(pd.statusbar).siblings().not('.error_file_upload').size() === 0
          });
          return $(pd.statusbar).remove();
        } else {
          return $(pd.statusbar).find(".ajax-file-upload-progress").html("<span style='color: red;'>" + res_upload + "</span>");
        }
      }),
      onError: (function(files, status, errMsg, pd) {
        return $(pd.statusbar).addClass('error_file_upload').find(".ajax-file-upload-filename").append(" <i class='fa fa-times btn btn-danger btn-xs' onclick='$(this).closest(\".ajax-file-upload-statusbar\").remove();'></i>");
      })
    });
    media_panel.find(".media_folder_breadcrumb").on("click", "a", function() {
      media_panel.trigger("navigate_to", {
        folder: $(this).attr("data-path")
      });
      return false;
    });
    media_panel.on("click", ".folder_item", function() {
      var f;
      f = media_panel.attr("data-folder") + "/" + $(this).attr("data-key");
      if ($(this).attr("data-key").search('/') >= 0) {
        f = $(this).attr("data-key");
      }
      return media_panel.trigger("navigate_to", {
        folder: f.replace(/\/{2,}/g, '/')
      });
    });
    media_panel.bind("update_breadcrumb", function() {
      var breadrumb, folder, folder_items, folder_prefix, index, j, len, name, value;
      folder = media_panel.attr("data-folder").replace("//", "/");
      folder_prefix = [];
      if (folder === "/" || folder === "") {
        folder_items = ["/"];
      } else {
        folder_items = folder.split("/");
      }
      breadrumb = [];
      for (index = j = 0, len = folder_items.length; j < len; index = ++j) {
        value = folder_items[index];
        name = value;
        if (value === "/" || value === "") {
          name = I18n("button.root");
        }
        if (index === folder_items.length - 1) {
          breadrumb.push("<li><span>" + name + "</span></li>");
        } else {
          folder_prefix.push(value);
          breadrumb.push("<li><a data-path='" + (folder_prefix.join("/") || "/").replace(/\/{2,}/g, '/') + "' href='#'>" + name + "</a></li>");
        }
      }
      return media_panel.find(".media_folder_breadcrumb").html(breadrumb.join(""));
    }).trigger("update_breadcrumb");
    media_panel.bind("navigate_to", function(e, data) {
      var folder, req_params;
      if (data["folder"]) {
        media_panel.attr("data-folder", data["folder"]);
      }
      folder = media_panel.attr("data-folder");
      media_panel.trigger("update_breadcrumb");
      req_params = cama_media_get_custom_params({
        partial: true,
        folder: folder
      });
      if (data["paginate"]) {
        req_params = media_panel.data('last_req_params') || req_params;
      } else {
        media_info.html("");
        media_link_tab_upload.click();
      }
      media_panel.data('last_req_params', $.extend({}, req_params, data['custom_params'] || {}));
      showLoading();
      return $.getJSON(media_panel.attr("data-url"), media_panel.data('last_req_params'), function(res) {
        var last_folder;
        if (data["paginate"]) {
          if (media_files_panel.children('.file_item').length > 0) {
            media_files_panel.append(res.html);
          } else {
            last_folder = media_files_panel.children('.folder_item:last');
            if (last_folder.length === 1) {
              last_folder.after(res.html);
            } else {
              media_files_panel.append(res.html);
            }
          }
        } else {
          media_files_panel.html(res.html);
        }
        media_files_panel.attr('data-next-page', res.next_page);
        return hideLoading();
      });
    }).bind("add_file", function(e, data) {
      var item, last_folder;
      item = $(data["item"]).hide();
      last_folder = media_files_panel.children('.folder_item:last');
      if (last_folder.length === 1) {
        last_folder.after(item);
      } else {
        media_files_panel.prepend(item);
      }
      if (data["selected"] === true || data["selected"] === void 0) {
        item.click();
      }
      media_files_panel.scrollTop(0);
      return item.fadeIn(1500);
    });
    media_panel.find('#cama_search_form').submit(function() {
      media_panel.trigger('navigate_to', {
        custom_params: {
          search: $(this).find('input:text').val()
        }
      });
      return false;
    });
    media_panel.find('.cam_media_reload').click(function(e, data) {
      media_panel.trigger('navigate_to', {
        custom_params: {
          cama_media_reload: $(this).attr('data-action')
        }
      });
      return e.preventDefault();
    });
    media_panel.on("click", "a.add_folder", function() {
      var callback, content;
      content = $("<form id='add_folder_form'><div><label for=''>" + I18n('button.folder') + ": </label> <div class='input-group'><input name='folder' class='form-control required' placeholder='Folder name..'><span class='input-group-btn'><button class='btn btn-primary' type='submit'>" + I18n('button.create') + "</button></span></div></div> </form>");
      callback = function(modal) {
        var btn, input;
        btn = modal.find(".btn-primary");
        input = modal.find("input").keyup(function() {
          if ($(this).val()) {
            return btn.removeAttr("disabled");
          } else {
            return btn.attr("disabled", "true");
          }
        }).trigger("keyup");
        return modal.find("form").submit(function() {
          showLoading();
          $.post(media_panel.attr("data-url_actions"), cama_media_get_custom_params({
            folder: media_panel.attr("data-folder") + "/" + input.val(),
            media_action: "new_folder"
          }), function(res) {
            hideLoading();
            modal.modal("hide");
            if (res.search("folder_item") >= 0) {
              res = $(res);
              media_files_panel.append(res);
              return res.click();
            } else {
              return $.fn.alert({
                type: 'error',
                content: res,
                title: "Error"
              });
            }
          });
          return false;
        });
      };
      open_modal({
        title: "New Folder",
        content: content,
        callback: callback,
        zindex: 9999999
      });
      return false;
    });
    media_panel.on("click", "a.del_item, a.del_folder", function() {
      var item, link;
      if (!confirm(I18n("msg.delete_item"))) {
        return false;
      }
      link = $(this);
      item = link.closest(".media_item");
      showLoading();
      $.post(media_panel.attr("data-url_actions"), cama_media_get_custom_params({
        folder: media_panel.attr("data-folder") + "/" + item.attr("data-key"),
        media_action: link.hasClass("del_folder") ? "del_folder" : "del_file"
      }), function(res) {
        hideLoading();
        if (res) {
          return $.fn.alert({
            type: 'error',
            content: res,
            title: I18n("button.error")
          });
        } else {
          item.remove();
          return media_info.html("");
        }
      }).error(function() {
        return $.fn.alert({
          type: 'error',
          content: I18n("msg.internal_error"),
          title: I18n("button.error")
        });
      });
      return false;
    });
    media_panel.on('click', '.edit_item', function() {
      var cropper, cropper_data, data, edit_callback, item, link;
      link = $(this);
      item = link.closest(".media_item");
      data = file_data(item);
      cropper = null;
      cropper_data = null;
      edit_callback = function(modal) {
        var btn, cmd, field_height, field_width, icon, ref, save_btn, save_image;
        field_width = modal.find('.export_image .with_image');
        field_height = modal.find('.export_image .height_image');
        save_image = function(name, same_name) {
          return $.fn.upload_url({
            url: cropper.cropper('getCroppedCanvas', {
              width: field_width.val(),
              height: field_height.val()
            }).toDataURL('image/jpeg'),
            name: name,
            same_name: same_name,
            callback: function(res) {
              return modal.modal('hide');
            }
          });
        };
        ref = {
          arrows: "('setDragMode', 'move')",
          crop: "('setDragMode', 'crop')",
          'search-plus': "('zoom', 0.1)",
          'search-minus': "('zoom', -0.1)",
          'arrow-left': "('move', -10, 0)",
          'arrow-right': "('move', 10, 0)",
          'arrow-up': "('move', 0, -10)",
          'arrow-down': "('move', 0, 10)",
          'rotate-left': "('rotate', -45)",
          'rotate-right': "('rotate', 45)",
          'arrows-h': "('scaleX', -1)",
          'arrows-v': "('scaleY', -1)",
          refresh: "('reset')"
        };
        for (icon in ref) {
          cmd = ref[icon];
          btn = $('<button type="button" class="btn btn-default" data-cmd="' + cmd + '"><i class="fa fa-' + icon + '"></i></button>');
          modal.find('.editor_controls').append(btn);
          btn.click(function() {
            btn = $(this);
            cmd = btn.data('cmd');
            if (cmd === "('scaleY', -1)" || cmd === "('scaleX', -1)") {
              btn.data('cmd', cmd.replace('-1', '1'));
            } else if (cmd === "('scaleY', 1)" || cmd === "('scaleX', 1)") {
              btn.data('cmd', cmd.replace('1', '-1'));
            }
            eval('cropper.cropper' + cmd);
            if (cmd === "('reset')") {
              return cropper.cropper('setData', cropper_data['data']);
            }
          });
        }
        save_btn = modal.find('.export_image').submit(function() {
          var save_buttons;
          if (!$(this).valid()) {
            return false;
          }
          save_buttons = function(modal2) {
            modal2.find('img.preview').attr('src', cropper.cropper('getCroppedCanvas', {
              width: field_width.val(),
              height: field_height.val()
            }).toDataURL('image/jpeg'));
            modal2.find('.save_btn').click(function() {
              save_image(data['name'], true);
              modal2.modal('hide');
              return item.remove();
            });
            return modal2.find('form').validate({
              submitHandler: function() {
                save_image(modal2.find('.file_name').val() + '.' + data['name'].split('.').pop());
                modal2.modal('hide');
                return false;
              }
            });
          };
          open_modal({
            zindex: 999992,
            modal_size: 'modal-lg',
            id: 'media_preview_editted_image',
            content: '<div class="text-center" style="overflow: auto;"><img class="preview"></div><br><div class="row"><div class="col-md-4"><button class="btn save_btn btn-default">' + I18n('button.replace_image') + '</button></div><div class="col-md-8"><form class="input-group"><input type="text" class="form-control file_name required" name="file_name"><div class="input-group-btn"><button class="btn btn-primary" type="submit">' + I18n('button.save_new_image') + '</button></div></form></div></div>',
            callback: save_buttons
          });
          return false;
        }).validate();
        field_width.change(function() {
          var croper_area;
          if (!field_width.attr("readonly")) {
            croper_area = modal.find('.cropper-crop-box');
            return field_height.val(parseInt((parseInt($(this).val()) / croper_area.width()) * croper_area.height()));
          }
        });
        showLoading();
        return modal.find('img.editable').load(function() {
          return setTimeout(function() {
            var dim, label;
            label = modal.find('.label_dimension');
            cropper_data = {
              data: {},
              minContainerHeight: 450,
              modal: true,
              crop: function(e) {
                label.html(Math.round(e.width) + " x " + Math.round(e.height));
                if (!field_width.attr("readonly")) {
                  field_width.val(Math.round(e.width));
                }
                if (!field_height.attr("readonly")) {
                  return field_height.val(Math.round(e.height));
                }
              },
              built: function() {
                return $.get(data['url']).error(function() {
                  return modal.find('.modal-body').html('<div class="alert alert-danger">' + I18n('msg.cors_error', 'Please verify the following: <ul><li>If the image exist: %{url_img}</li> <li>Check if cors configuration are defined well, only for external images: S3, cloudfront(if you are using cloudfront).</li></ul><br> More information about CORS: <a href="%{url_blog}" target="_blank">here.</a>', {
                    url_img: data['url'],
                    url_blog: 'http://blog.celingest.com/en/2014/10/02/tutorial-using-cors-with-cloudfront-and-s3/'
                  }) + '</div>');
                });
              }
            };
            if (media_panel.attr("data-dimension")) {
              dim = media_panel.attr("data-dimension").split('x');
              if (dim[0]) {
                cropper_data['data']['width'] = parseFloat(dim[0].match(/\d+/)[0]);
                field_width.val(cropper_data['data']['width']);
                if (dim[0].search(/\?/) > -1) {
                  field_width.attr('max', cropper_data['data']['width']);
                } else {
                  field_width.prop('readonly', true);
                }
              }
              if (dim[1]) {
                cropper_data['data']['height'] = parseFloat(dim[1].match(/\d+/)[0]);
                field_height.val(cropper_data['data']['height']);
                if (dim[1].search(/\?/) > -1) {
                  field_height.attr('max', cropper_data['data']['height']);
                } else {
                  field_height.prop('readonly', true);
                }
              }
              if (dim[0] && dim[0].search(/\?/) === -1 && dim[1] && dim[1].search(/\?/) === -1) {
                cropper_data['aspectRatio'] = cropper_data['data']['width'] / cropper_data['data']['height'];
              }
            }
            cropper = modal.find('img.editable').cropper(cropper_data);
            return hideLoading();
          }, 300);
        });
      };
      open_modal({
        zindex: 999991,
        id: 'media_panel_editor_image',
        title: I18n('button.edit_image', 'Edit Image') + ' - ' + data['name'] + (media_panel.attr("data-dimension") ? " <small><i>(" + media_panel.attr("data-dimension") + ")</i></small>" : ''),
        content: '<div>' + '<div class="editable_wrapper">' + '<img style="max-width: 100%;" class="editable" id="media_editable_image" src="' + data['url'] + '">' + '</div>' + '<div class="row" style="margin-top: 5px;">' + '<div class="col-md-8">' + '<div class="editor_controls btn-group"></div>' + '</div>' + '<div class="col-md-4">' + '<form class="export_image"> ' + '<div class="input-group"><input class="form-control with_image data-error-place-parent required number" placeholder="Width"><span class="input-group-addon">x</span>' + '<input class="form-control height_image data-error-place-parent required number" placeholder="Height"> ' + '<span class="input-group-btn"><button class="btn btn-primary save_image" type="submit"><i class="fa fa-save"></i> ' + I18n('button.save', 'Save Image') + '</button> </span> </div>' + '</form>' + '</div>' + '</div>' + '<!--span class="label label-default pull-right label_dimension"></span-->' + '</div>',
        callback: edit_callback,
        modal_size: 'modal-lg'
      });
      return false;
    });
    return media_panel.find("#cama_media_external").submit(function() {
      if (!$(this).valid()) {
        return false;
      }
      $.fn.upload_url({
        url: $(this).find("input").val(),
        skip_auto_crop: true,
        callback: function() {
          return media_panel.find("#cama_media_external")[0].reset();
        }
      });
      return false;
    }).validate();
  };

  window['cama_media_get_custom_params'] = function(custom_settings) {
    var media_panel, r;
    media_panel = $("#cama_media_gallery");
    r = eval("(" + media_panel.attr('data-extra-params') + ")");
    r['folder'] = media_panel.attr("data-folder");
    if (custom_settings) {
      $.extend(r, custom_settings);
    }
    r['folder'] = r['folder'].replace(/\/{2,}/g, '/');
    return r;
  };

  $(function() {
    return $.fn.upload_url = function(args) {
      var data, media_panel, on_error;
      media_panel = $("#cama_media_gallery");
      data = cama_media_get_custom_params({
        media_action: "crop_url",
        onerror: function(message) {
          return $.fn.alert({
            type: 'error',
            content: message,
            title: I18n("msg.error_uploading")
          });
        }
      });
      $.extend(data, args);
      on_error = data["onerror"];
      delete data["onerror"];
      showLoading();
      return $.post(media_panel.attr("data-url_actions"), data, function(res_upload) {
        hideLoading();
        if (res_upload.search("media_item") >= 0) {
          media_panel.trigger("add_file", {
            item: res_upload
          });
          if (data["callback"]) {
            return data["callback"](res_upload);
          }
        } else {
          return $.fn.alert({
            type: 'error',
            content: res_upload,
            title: I18n("button.error")
          });
        }
      }).error(function() {
        return $.fn.alert({
          type: 'error',
          content: I18n("msg.internal_error"),
          title: I18n("button.error")
        });
      });
    };
  });

  $(function() {
    return $.fn.upload_filemanager = function(args) {
      args = args || {};
      if (args["formats"] === 'null') {
        args["formats"] = '';
      }
      if (args["dimension"] === 'null') {
        args["dimension"] = '';
      }
      if (args["versions"] === 'null') {
        args["versions"] = '';
      }
      if (args["thumb_size"] === 'null') {
        args["thumb_size"] = '';
      }
      return open_modal({
        title: args["title"] || I18n("msg.media_title"),
        id: 'cama_modal_file_uploader',
        modal_size: "modal-lg",
        mode: "ajax",
        url: root_admin_url + "/media/ajax",
        ajax_params: {
          media_formats: args["formats"],
          dimension: args["dimension"],
          versions: args["versions"],
          thumb_size: args["thumb_size"],
          "private": args['private']
        },
        callback: function(modal) {
          if (args["selected"]) {
            window["callback_media_uploader"] = args["selected"];
          }
          return modal.css("z-index", args["zindex"] || 99999).children(".modal-dialog").css("width", "90%");
        }
      });
    };
  });

  window['cama_humanFileSize'] = function(size) {
    var i, units;
    units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    i = 0;
    while (size >= 1024) {
      size /= 1024;
      ++i;
    }
    return size.toFixed(1) + ' ' + units[i];
  };

}).call(this);
/*!
 * Cropper v2.3.4
 * https://github.com/fengyuanchen/cropper
 *
 * Copyright (c) 2014-2016 Fengyuan Chen and contributors
 * Released under the MIT license
 *
 * Date: 2016-09-03T05:50:45.412Z
 */


(function (factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as anonymous module.
        define(['jquery'], factory);
    } else if (typeof exports === 'object') {
        // Node / CommonJS
        factory(require('jquery'));
    } else {
        // Browser globals.
        factory(jQuery);
    }
})(function ($) {

    'use strict';

    // Globals
    var $window = $(window);
    var $document = $(document);
    var location = window.location;
    var navigator = window.navigator;
    var ArrayBuffer = window.ArrayBuffer;
    var Uint8Array = window.Uint8Array;
    var DataView = window.DataView;
    var btoa = window.btoa;

    // Constants
    var NAMESPACE = 'cropper';

    // Classes
    var CLASS_MODAL = 'cropper-modal';
    var CLASS_HIDE = 'cropper-hide';
    var CLASS_HIDDEN = 'cropper-hidden';
    var CLASS_INVISIBLE = 'cropper-invisible';
    var CLASS_MOVE = 'cropper-move';
    var CLASS_CROP = 'cropper-crop';
    var CLASS_DISABLED = 'cropper-disabled';
    var CLASS_BG = 'cropper-bg';

    // Events
    var EVENT_MOUSE_DOWN = 'mousedown touchstart pointerdown MSPointerDown';
    var EVENT_MOUSE_MOVE = 'mousemove touchmove pointermove MSPointerMove';
    var EVENT_MOUSE_UP = 'mouseup touchend touchcancel pointerup pointercancel MSPointerUp MSPointerCancel';
    var EVENT_WHEEL = 'wheel mousewheel DOMMouseScroll';
    var EVENT_DBLCLICK = 'dblclick';
    var EVENT_LOAD = 'load.' + NAMESPACE;
    var EVENT_ERROR = 'error.' + NAMESPACE;
    var EVENT_RESIZE = 'resize.' + NAMESPACE; // Bind to window with namespace
    var EVENT_BUILD = 'build.' + NAMESPACE;
    var EVENT_BUILT = 'built.' + NAMESPACE;
    var EVENT_CROP_START = 'cropstart.' + NAMESPACE;
    var EVENT_CROP_MOVE = 'cropmove.' + NAMESPACE;
    var EVENT_CROP_END = 'cropend.' + NAMESPACE;
    var EVENT_CROP = 'crop.' + NAMESPACE;
    var EVENT_ZOOM = 'zoom.' + NAMESPACE;

    // RegExps
    var REGEXP_ACTIONS = /^(e|w|s|n|se|sw|ne|nw|all|crop|move|zoom)$/;
    var REGEXP_DATA_URL = /^data:/;
    var REGEXP_DATA_URL_HEAD = /^data:([^;]+);base64,/;
    var REGEXP_DATA_URL_JPEG = /^data:image\/jpeg.*;base64,/;

    // Data keys
    var DATA_PREVIEW = 'preview';
    var DATA_ACTION = 'action';

    // Actions
    var ACTION_EAST = 'e';
    var ACTION_WEST = 'w';
    var ACTION_SOUTH = 's';
    var ACTION_NORTH = 'n';
    var ACTION_SOUTH_EAST = 'se';
    var ACTION_SOUTH_WEST = 'sw';
    var ACTION_NORTH_EAST = 'ne';
    var ACTION_NORTH_WEST = 'nw';
    var ACTION_ALL = 'all';
    var ACTION_CROP = 'crop';
    var ACTION_MOVE = 'move';
    var ACTION_ZOOM = 'zoom';
    var ACTION_NONE = 'none';

    // Supports
    var SUPPORT_CANVAS = $.isFunction($('<canvas>')[0].getContext);
    var IS_SAFARI_OR_UIWEBVIEW = navigator && /(Macintosh|iPhone|iPod|iPad).*AppleWebKit/i.test(navigator.userAgent);

    // Maths
    var num = Number;
    var min = Math.min;
    var max = Math.max;
    var abs = Math.abs;
    var sin = Math.sin;
    var cos = Math.cos;
    var sqrt = Math.sqrt;
    var round = Math.round;
    var floor = Math.floor;

    // Utilities
    var fromCharCode = String.fromCharCode;

    function isNumber(n) {
        return typeof n === 'number' && !isNaN(n);
    }

    function isUndefined(n) {
        return typeof n === 'undefined';
    }

    function toArray(obj, offset) {
        var args = [];

        // This is necessary for IE8
        if (isNumber(offset)) {
            args.push(offset);
        }

        return args.slice.apply(obj, args);
    }

    // Custom proxy to avoid jQuery's guid
    function proxy(fn, context) {
        var args = toArray(arguments, 2);

        return function () {
            return fn.apply(context, args.concat(toArray(arguments)));
        };
    }

    function isCrossOriginURL(url) {
        var parts = url.match(/^(https?:)\/\/([^\:\/\?#]+):?(\d*)/i);

        return parts && (
                parts[1] !== location.protocol ||
                parts[2] !== location.hostname ||
                parts[3] !== location.port
            );
    }

    function addTimestamp(url) {
        var timestamp = 'timestamp=' + (new Date()).getTime();

        return (url + (url.indexOf('?') === -1 ? '?' : '&') + timestamp);
    }

    function getCrossOrigin(crossOrigin) {
        return crossOrigin ? ' crossOrigin="' + crossOrigin + '"' : '';
    }

    function getImageSize(image, callback) {
        var newImage;

        // Modern browsers (ignore Safari, #120 & #509)
        if (image.naturalWidth && !IS_SAFARI_OR_UIWEBVIEW) {
            return callback(image.naturalWidth, image.naturalHeight);
        }

        // IE8: Don't use `new Image()` here (#319)
        newImage = document.createElement('img');

        newImage.onload = function () {
            callback(this.width, this.height);
        };

        newImage.src = image.src;
    }

    function getTransform(options) {
        var transforms = [];
        var rotate = options.rotate;
        var scaleX = options.scaleX;
        var scaleY = options.scaleY;

        // Rotate should come first before scale to match orientation transform
        if (isNumber(rotate) && rotate !== 0) {
            transforms.push('rotate(' + rotate + 'deg)');
        }

        if (isNumber(scaleX) && scaleX !== 1) {
            transforms.push('scaleX(' + scaleX + ')');
        }

        if (isNumber(scaleY) && scaleY !== 1) {
            transforms.push('scaleY(' + scaleY + ')');
        }

        return transforms.length ? transforms.join(' ') : 'none';
    }

    function getRotatedSizes(data, isReversed) {
        var deg = abs(data.degree) % 180;
        var arc = (deg > 90 ? (180 - deg) : deg) * Math.PI / 180;
        var sinArc = sin(arc);
        var cosArc = cos(arc);
        var width = data.width;
        var height = data.height;
        var aspectRatio = data.aspectRatio;
        var newWidth;
        var newHeight;

        if (!isReversed) {
            newWidth = width * cosArc + height * sinArc;
            newHeight = width * sinArc + height * cosArc;
        } else {
            newWidth = width / (cosArc + sinArc / aspectRatio);
            newHeight = newWidth / aspectRatio;
        }

        return {
            width: newWidth,
            height: newHeight
        };
    }

    function getSourceCanvas(image, data) {
        var canvas = $('<canvas>')[0];
        var context = canvas.getContext('2d');
        var dstX = 0;
        var dstY = 0;
        var dstWidth = data.naturalWidth;
        var dstHeight = data.naturalHeight;
        var rotate = data.rotate;
        var scaleX = data.scaleX;
        var scaleY = data.scaleY;
        var scalable = isNumber(scaleX) && isNumber(scaleY) && (scaleX !== 1 || scaleY !== 1);
        var rotatable = isNumber(rotate) && rotate !== 0;
        var advanced = rotatable || scalable;
        var canvasWidth = dstWidth * abs(scaleX || 1);
        var canvasHeight = dstHeight * abs(scaleY || 1);
        var translateX;
        var translateY;
        var rotated;

        if (scalable) {
            translateX = canvasWidth / 2;
            translateY = canvasHeight / 2;
        }

        if (rotatable) {
            rotated = getRotatedSizes({
                width: canvasWidth,
                height: canvasHeight,
                degree: rotate
            });

            canvasWidth = rotated.width;
            canvasHeight = rotated.height;
            translateX = canvasWidth / 2;
            translateY = canvasHeight / 2;
        }

        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        if (advanced) {
            dstX = -dstWidth / 2;
            dstY = -dstHeight / 2;

            context.save();
            context.translate(translateX, translateY);
        }

        // Rotate should come first before scale as in the "getTransform" function
        if (rotatable) {
            context.rotate(rotate * Math.PI / 180);
        }

        if (scalable) {
            context.scale(scaleX, scaleY);
        }

        context.drawImage(image, floor(dstX), floor(dstY), floor(dstWidth), floor(dstHeight));

        if (advanced) {
            context.restore();
        }

        return canvas;
    }

    function getTouchesCenter(touches) {
        var length = touches.length;
        var pageX = 0;
        var pageY = 0;

        if (length) {
            $.each(touches, function (i, touch) {
                pageX += touch.pageX;
                pageY += touch.pageY;
            });

            pageX /= length;
            pageY /= length;
        }

        return {
            pageX: pageX,
            pageY: pageY
        };
    }

    function getStringFromCharCode(dataView, start, length) {
        var str = '';
        var i;

        for (i = start, length += start; i < length; i++) {
            str += fromCharCode(dataView.getUint8(i));
        }

        return str;
    }

    function getOrientation(arrayBuffer) {
        var dataView = new DataView(arrayBuffer);
        var length = dataView.byteLength;
        var orientation;
        var exifIDCode;
        var tiffOffset;
        var firstIFDOffset;
        var littleEndian;
        var endianness;
        var app1Start;
        var ifdStart;
        var offset;
        var i;

        // Only handle JPEG image (start by 0xFFD8)
        if (dataView.getUint8(0) === 0xFF && dataView.getUint8(1) === 0xD8) {
            offset = 2;

            while (offset < length) {
                if (dataView.getUint8(offset) === 0xFF && dataView.getUint8(offset + 1) === 0xE1) {
                    app1Start = offset;
                    break;
                }

                offset++;
            }
        }

        if (app1Start) {
            exifIDCode = app1Start + 4;
            tiffOffset = app1Start + 10;

            if (getStringFromCharCode(dataView, exifIDCode, 4) === 'Exif') {
                endianness = dataView.getUint16(tiffOffset);
                littleEndian = endianness === 0x4949;

                if (littleEndian || endianness === 0x4D4D /* bigEndian */) {
                    if (dataView.getUint16(tiffOffset + 2, littleEndian) === 0x002A) {
                        firstIFDOffset = dataView.getUint32(tiffOffset + 4, littleEndian);

                        if (firstIFDOffset >= 0x00000008) {
                            ifdStart = tiffOffset + firstIFDOffset;
                        }
                    }
                }
            }
        }

        if (ifdStart) {
            length = dataView.getUint16(ifdStart, littleEndian);

            for (i = 0; i < length; i++) {
                offset = ifdStart + i * 12 + 2;

                if (dataView.getUint16(offset, littleEndian) === 0x0112 /* Orientation */) {

                    // 8 is the offset of the current tag's value
                    offset += 8;

                    // Get the original orientation value
                    orientation = dataView.getUint16(offset, littleEndian);

                    // Override the orientation with its default value for Safari (#120)
                    if (IS_SAFARI_OR_UIWEBVIEW) {
                        dataView.setUint16(offset, 1, littleEndian);
                    }

                    break;
                }
            }
        }

        return orientation;
    }

    function dataURLToArrayBuffer(dataURL) {
        var base64 = dataURL.replace(REGEXP_DATA_URL_HEAD, '');
        var binary = atob(base64);
        var length = binary.length;
        var arrayBuffer = new ArrayBuffer(length);
        var dataView = new Uint8Array(arrayBuffer);
        var i;

        for (i = 0; i < length; i++) {
            dataView[i] = binary.charCodeAt(i);
        }

        return arrayBuffer;
    }

    // Only available for JPEG image
    function arrayBufferToDataURL(arrayBuffer) {
        var dataView = new Uint8Array(arrayBuffer);
        var length = dataView.length;
        var base64 = '';
        var i;

        for (i = 0; i < length; i++) {
            base64 += fromCharCode(dataView[i]);
        }

        return 'data:image/jpeg;base64,' + btoa(base64);
    }

    function Cropper(element, options) {
        this.$element = $(element);
        this.options = $.extend({}, Cropper.DEFAULTS, $.isPlainObject(options) && options);
        this.isLoaded = false;
        this.isBuilt = false;
        this.isCompleted = false;
        this.isRotated = false;
        this.isCropped = false;
        this.isDisabled = false;
        this.isReplaced = false;
        this.isLimited = false;
        this.wheeling = false;
        this.isImg = false;
        this.originalUrl = '';
        this.canvas = null;
        this.cropBox = null;
        this.init();
    }

    Cropper.prototype = {
        constructor: Cropper,

        init: function () {
            var $this = this.$element;
            var url;

            if ($this.is('img')) {
                this.isImg = true;

                // Should use `$.fn.attr` here. e.g.: "img/picture.jpg"
                this.originalUrl = url = $this.attr('src');

                // Stop when it's a blank image
                if (!url) {
                    return;
                }

                // Should use `$.fn.prop` here. e.g.: "http://example.com/img/picture.jpg"
                url = $this.prop('src');
            } else if ($this.is('canvas') && SUPPORT_CANVAS) {
                url = $this[0].toDataURL();
            }

            this.load(url);
        },

        // A shortcut for triggering custom events
        trigger: function (type, data) {
            var e = $.Event(type, data);

            this.$element.trigger(e);

            return e;
        },

        load: function (url) {
            var options = this.options;
            var $this = this.$element;
            var read;
            var xhr;

            if (!url) {
                return;
            }

            // Trigger build event first
            $this.one(EVENT_BUILD, options.build);

            if (this.trigger(EVENT_BUILD).isDefaultPrevented()) {
                return;
            }

            this.url = url;
            this.image = {};

            if (!options.checkOrientation || !ArrayBuffer) {
                return this.clone();
            }

            read = $.proxy(this.read, this);

            // XMLHttpRequest disallows to open a Data URL in some browsers like IE11 and Safari
            if (REGEXP_DATA_URL.test(url)) {
                return REGEXP_DATA_URL_JPEG.test(url) ?
                    read(dataURLToArrayBuffer(url)) :
                    this.clone();
            }

            xhr = new XMLHttpRequest();

            xhr.onerror = xhr.onabort = $.proxy(function () {
                this.clone();
            }, this);

            xhr.onload = function () {
                read(this.response);
            };

            if (options.checkCrossOrigin && isCrossOriginURL(url) && $this.prop('crossOrigin')) {
                url = addTimestamp(url);
            }

            xhr.open('get', url);
            xhr.responseType = 'arraybuffer';
            xhr.send();
        },

        read: function (arrayBuffer) {
            var options = this.options;
            var orientation = getOrientation(arrayBuffer);
            var image = this.image;
            var rotate = 0;
            var scaleX = 1;
            var scaleY = 1;

            if (orientation > 1) {
                this.url = arrayBufferToDataURL(arrayBuffer);

                switch (orientation) {

                    // flip horizontal
                    case 2:
                        scaleX = -1;
                        break;

                    // rotate left 180°
                    case 3:
                        rotate = -180;
                        break;

                    // flip vertical
                    case 4:
                        scaleY = -1;
                        break;

                    // flip vertical + rotate right 90°
                    case 5:
                        rotate = 90;
                        scaleY = -1;
                        break;

                    // rotate right 90°
                    case 6:
                        rotate = 90;
                        break;

                    // flip horizontal + rotate right 90°
                    case 7:
                        rotate = 90;
                        scaleX = -1;
                        break;

                    // rotate left 90°
                    case 8:
                        rotate = -90;
                        break;
                }
            }

            if (options.rotatable) {
                image.rotate = rotate;
            }

            if (options.scalable) {
                image.scaleX = scaleX;
                image.scaleY = scaleY;
            }

            this.clone();
        },

        clone: function () {
            var options = this.options;
            var $this = this.$element;
            var url = this.url;
            var crossOrigin = '';
            var crossOriginUrl;
            var $clone;

            if (options.checkCrossOrigin && isCrossOriginURL(url)) {
                crossOrigin = $this.prop('crossOrigin');

                if (crossOrigin) {
                    crossOriginUrl = url;
                } else {
                    crossOrigin = 'anonymous';

                    // Bust cache (#148) when there is not a "crossOrigin" property
                    crossOriginUrl = addTimestamp(url);
                }
            }

            this.crossOrigin = crossOrigin;
            this.crossOriginUrl = crossOriginUrl;
            this.$clone = $clone = $('<img' + getCrossOrigin(crossOrigin) + ' src="' + (crossOriginUrl || url) + '">');

            if (this.isImg) {
                if ($this[0].complete) {
                    this.start();
                } else {
                    $this.one(EVENT_LOAD, $.proxy(this.start, this));
                }
            } else {
                $clone.
                one(EVENT_LOAD, $.proxy(this.start, this)).
                one(EVENT_ERROR, $.proxy(this.stop, this)).
                addClass(CLASS_HIDE).
                insertAfter($this);
            }
        },

        start: function () {
            var $image = this.$element;
            var $clone = this.$clone;

            if (!this.isImg) {
                $clone.off(EVENT_ERROR, this.stop);
                $image = $clone;
            }

            getImageSize($image[0], $.proxy(function (naturalWidth, naturalHeight) {
                $.extend(this.image, {
                    naturalWidth: naturalWidth,
                    naturalHeight: naturalHeight,
                    aspectRatio: naturalWidth / naturalHeight
                });

                this.isLoaded = true;
                this.build();
            }, this));
        },

        stop: function () {
            this.$clone.remove();
            this.$clone = null;
        },

        build: function () {
            var options = this.options;
            var $this = this.$element;
            var $clone = this.$clone;
            var $cropper;
            var $cropBox;
            var $face;

            if (!this.isLoaded) {
                return;
            }

            // Unbuild first when replace
            if (this.isBuilt) {
                this.unbuild();
            }

            // Create cropper elements
            this.$container = $this.parent();
            this.$cropper = $cropper = $(Cropper.TEMPLATE);
            this.$canvas = $cropper.find('.cropper-canvas').append($clone);
            this.$dragBox = $cropper.find('.cropper-drag-box');
            this.$cropBox = $cropBox = $cropper.find('.cropper-crop-box');
            this.$viewBox = $cropper.find('.cropper-view-box');
            this.$face = $face = $cropBox.find('.cropper-face');

            // Hide the original image
            $this.addClass(CLASS_HIDDEN).after($cropper);

            // Show the clone image if is hidden
            if (!this.isImg) {
                $clone.removeClass(CLASS_HIDE);
            }

            this.initPreview();
            this.bind();

            options.aspectRatio = max(0, options.aspectRatio) || NaN;
            options.viewMode = max(0, min(3, round(options.viewMode))) || 0;

            if (options.autoCrop) {
                this.isCropped = true;

                if (options.modal) {
                    this.$dragBox.addClass(CLASS_MODAL);
                }
            } else {
                $cropBox.addClass(CLASS_HIDDEN);
            }

            if (!options.guides) {
                $cropBox.find('.cropper-dashed').addClass(CLASS_HIDDEN);
            }

            if (!options.center) {
                $cropBox.find('.cropper-center').addClass(CLASS_HIDDEN);
            }

            if (options.cropBoxMovable) {
                $face.addClass(CLASS_MOVE).data(DATA_ACTION, ACTION_ALL);
            }

            if (!options.highlight) {
                $face.addClass(CLASS_INVISIBLE);
            }

            if (options.background) {
                $cropper.addClass(CLASS_BG);
            }

            if (!options.cropBoxResizable) {
                $cropBox.find('.cropper-line, .cropper-point').addClass(CLASS_HIDDEN);
            }

            this.setDragMode(options.dragMode);
            this.render();
            this.isBuilt = true;
            this.setData(options.data);
            $this.one(EVENT_BUILT, options.built);

            // Trigger the built event asynchronously to keep `data('cropper')` is defined
            this.completing = setTimeout($.proxy(function () {
                this.trigger(EVENT_BUILT);
                this.trigger(EVENT_CROP, this.getData());
                this.isCompleted = true;
            }, this), 0);
        },

        unbuild: function () {
            if (!this.isBuilt) {
                return;
            }

            if (!this.isCompleted) {
                clearTimeout(this.completing);
            }

            this.isBuilt = false;
            this.isCompleted = false;
            this.initialImage = null;

            // Clear `initialCanvas` is necessary when replace
            this.initialCanvas = null;
            this.initialCropBox = null;
            this.container = null;
            this.canvas = null;

            // Clear `cropBox` is necessary when replace
            this.cropBox = null;
            this.unbind();

            this.resetPreview();
            this.$preview = null;

            this.$viewBox = null;
            this.$cropBox = null;
            this.$dragBox = null;
            this.$canvas = null;
            this.$container = null;

            this.$cropper.remove();
            this.$cropper = null;
        },

        render: function () {
            this.initContainer();
            this.initCanvas();
            this.initCropBox();

            this.renderCanvas();

            if (this.isCropped) {
                this.renderCropBox();
            }
        },

        initContainer: function () {
            var options = this.options;
            var $this = this.$element;
            var $container = this.$container;
            var $cropper = this.$cropper;

            $cropper.addClass(CLASS_HIDDEN);
            $this.removeClass(CLASS_HIDDEN);

            $cropper.css((this.container = {
                width: max($container.width(), num(options.minContainerWidth) || 200),
                height: max($container.height(), num(options.minContainerHeight) || 100)
            }));

            $this.addClass(CLASS_HIDDEN);
            $cropper.removeClass(CLASS_HIDDEN);
        },

        // Canvas (image wrapper)
        initCanvas: function () {
            var viewMode = this.options.viewMode;
            var container = this.container;
            var containerWidth = container.width;
            var containerHeight = container.height;
            var image = this.image;
            var imageNaturalWidth = image.naturalWidth;
            var imageNaturalHeight = image.naturalHeight;
            var is90Degree = abs(image.rotate) === 90;
            var naturalWidth = is90Degree ? imageNaturalHeight : imageNaturalWidth;
            var naturalHeight = is90Degree ? imageNaturalWidth : imageNaturalHeight;
            var aspectRatio = naturalWidth / naturalHeight;
            var canvasWidth = containerWidth;
            var canvasHeight = containerHeight;
            var canvas;

            if (containerHeight * aspectRatio > containerWidth) {
                if (viewMode === 3) {
                    canvasWidth = containerHeight * aspectRatio;
                } else {
                    canvasHeight = containerWidth / aspectRatio;
                }
            } else {
                if (viewMode === 3) {
                    canvasHeight = containerWidth / aspectRatio;
                } else {
                    canvasWidth = containerHeight * aspectRatio;
                }
            }

            canvas = {
                naturalWidth: naturalWidth,
                naturalHeight: naturalHeight,
                aspectRatio: aspectRatio,
                width: canvasWidth,
                height: canvasHeight
            };

            canvas.oldLeft = canvas.left = (containerWidth - canvasWidth) / 2;
            canvas.oldTop = canvas.top = (containerHeight - canvasHeight) / 2;

            this.canvas = canvas;
            this.isLimited = (viewMode === 1 || viewMode === 2);
            this.limitCanvas(true, true);
            this.initialImage = $.extend({}, image);
            this.initialCanvas = $.extend({}, canvas);
        },

        limitCanvas: function (isSizeLimited, isPositionLimited) {
            var options = this.options;
            var viewMode = options.viewMode;
            var container = this.container;
            var containerWidth = container.width;
            var containerHeight = container.height;
            var canvas = this.canvas;
            var aspectRatio = canvas.aspectRatio;
            var cropBox = this.cropBox;
            var isCropped = this.isCropped && cropBox;
            var minCanvasWidth;
            var minCanvasHeight;
            var newCanvasLeft;
            var newCanvasTop;

            if (isSizeLimited) {
                minCanvasWidth = num(options.minCanvasWidth) || 0;
                minCanvasHeight = num(options.minCanvasHeight) || 0;

                if (viewMode) {
                    if (viewMode > 1) {
                        minCanvasWidth = max(minCanvasWidth, containerWidth);
                        minCanvasHeight = max(minCanvasHeight, containerHeight);

                        if (viewMode === 3) {
                            if (minCanvasHeight * aspectRatio > minCanvasWidth) {
                                minCanvasWidth = minCanvasHeight * aspectRatio;
                            } else {
                                minCanvasHeight = minCanvasWidth / aspectRatio;
                            }
                        }
                    } else {
                        if (minCanvasWidth) {
                            minCanvasWidth = max(minCanvasWidth, isCropped ? cropBox.width : 0);
                        } else if (minCanvasHeight) {
                            minCanvasHeight = max(minCanvasHeight, isCropped ? cropBox.height : 0);
                        } else if (isCropped) {
                            minCanvasWidth = cropBox.width;
                            minCanvasHeight = cropBox.height;

                            if (minCanvasHeight * aspectRatio > minCanvasWidth) {
                                minCanvasWidth = minCanvasHeight * aspectRatio;
                            } else {
                                minCanvasHeight = minCanvasWidth / aspectRatio;
                            }
                        }
                    }
                }

                if (minCanvasWidth && minCanvasHeight) {
                    if (minCanvasHeight * aspectRatio > minCanvasWidth) {
                        minCanvasHeight = minCanvasWidth / aspectRatio;
                    } else {
                        minCanvasWidth = minCanvasHeight * aspectRatio;
                    }
                } else if (minCanvasWidth) {
                    minCanvasHeight = minCanvasWidth / aspectRatio;
                } else if (minCanvasHeight) {
                    minCanvasWidth = minCanvasHeight * aspectRatio;
                }

                canvas.minWidth = minCanvasWidth;
                canvas.minHeight = minCanvasHeight;
                canvas.maxWidth = Infinity;
                canvas.maxHeight = Infinity;
            }

            if (isPositionLimited) {
                if (viewMode) {
                    newCanvasLeft = containerWidth - canvas.width;
                    newCanvasTop = containerHeight - canvas.height;

                    canvas.minLeft = min(0, newCanvasLeft);
                    canvas.minTop = min(0, newCanvasTop);
                    canvas.maxLeft = max(0, newCanvasLeft);
                    canvas.maxTop = max(0, newCanvasTop);

                    if (isCropped && this.isLimited) {
                        canvas.minLeft = min(
                            cropBox.left,
                            cropBox.left + cropBox.width - canvas.width
                        );
                        canvas.minTop = min(
                            cropBox.top,
                            cropBox.top + cropBox.height - canvas.height
                        );
                        canvas.maxLeft = cropBox.left;
                        canvas.maxTop = cropBox.top;

                        if (viewMode === 2) {
                            if (canvas.width >= containerWidth) {
                                canvas.minLeft = min(0, newCanvasLeft);
                                canvas.maxLeft = max(0, newCanvasLeft);
                            }

                            if (canvas.height >= containerHeight) {
                                canvas.minTop = min(0, newCanvasTop);
                                canvas.maxTop = max(0, newCanvasTop);
                            }
                        }
                    }
                } else {
                    canvas.minLeft = -canvas.width;
                    canvas.minTop = -canvas.height;
                    canvas.maxLeft = containerWidth;
                    canvas.maxTop = containerHeight;
                }
            }
        },

        renderCanvas: function (isChanged) {
            var canvas = this.canvas;
            var image = this.image;
            var rotate = image.rotate;
            var naturalWidth = image.naturalWidth;
            var naturalHeight = image.naturalHeight;
            var aspectRatio;
            var rotated;

            if (this.isRotated) {
                this.isRotated = false;

                // Computes rotated sizes with image sizes
                rotated = getRotatedSizes({
                    width: image.width,
                    height: image.height,
                    degree: rotate
                });

                aspectRatio = rotated.width / rotated.height;

                if (aspectRatio !== canvas.aspectRatio) {
                    canvas.left -= (rotated.width - canvas.width) / 2;
                    canvas.top -= (rotated.height - canvas.height) / 2;
                    canvas.width = rotated.width;
                    canvas.height = rotated.height;
                    canvas.aspectRatio = aspectRatio;
                    canvas.naturalWidth = naturalWidth;
                    canvas.naturalHeight = naturalHeight;

                    // Computes rotated sizes with natural image sizes
                    if (rotate % 180) {
                        rotated = getRotatedSizes({
                            width: naturalWidth,
                            height: naturalHeight,
                            degree: rotate
                        });

                        canvas.naturalWidth = rotated.width;
                        canvas.naturalHeight = rotated.height;
                    }

                    this.limitCanvas(true, false);
                }
            }

            if (canvas.width > canvas.maxWidth || canvas.width < canvas.minWidth) {
                canvas.left = canvas.oldLeft;
            }

            if (canvas.height > canvas.maxHeight || canvas.height < canvas.minHeight) {
                canvas.top = canvas.oldTop;
            }

            canvas.width = min(max(canvas.width, canvas.minWidth), canvas.maxWidth);
            canvas.height = min(max(canvas.height, canvas.minHeight), canvas.maxHeight);

            this.limitCanvas(false, true);

            canvas.oldLeft = canvas.left = min(max(canvas.left, canvas.minLeft), canvas.maxLeft);
            canvas.oldTop = canvas.top = min(max(canvas.top, canvas.minTop), canvas.maxTop);

            this.$canvas.css({
                width: canvas.width,
                height: canvas.height,
                left: canvas.left,
                top: canvas.top
            });

            this.renderImage();

            if (this.isCropped && this.isLimited) {
                this.limitCropBox(true, true);
            }

            if (isChanged) {
                this.output();
            }
        },

        renderImage: function (isChanged) {
            var canvas = this.canvas;
            var image = this.image;
            var reversed;

            if (image.rotate) {
                reversed = getRotatedSizes({
                    width: canvas.width,
                    height: canvas.height,
                    degree: image.rotate,
                    aspectRatio: image.aspectRatio
                }, true);
            }

            $.extend(image, reversed ? {
                width: reversed.width,
                height: reversed.height,
                left: (canvas.width - reversed.width) / 2,
                top: (canvas.height - reversed.height) / 2
            } : {
                width: canvas.width,
                height: canvas.height,
                left: 0,
                top: 0
            });

            this.$clone.css({
                width: image.width,
                height: image.height,
                marginLeft: image.left,
                marginTop: image.top,
                transform: getTransform(image)
            });

            if (isChanged) {
                this.output();
            }
        },

        initCropBox: function () {
            var options = this.options;
            var canvas = this.canvas;
            var aspectRatio = options.aspectRatio;
            var autoCropArea = num(options.autoCropArea) || 0.8;
            var cropBox = {
                width: canvas.width,
                height: canvas.height
            };

            if (aspectRatio) {
                if (canvas.height * aspectRatio > canvas.width) {
                    cropBox.height = cropBox.width / aspectRatio;
                } else {
                    cropBox.width = cropBox.height * aspectRatio;
                }
            }

            this.cropBox = cropBox;
            this.limitCropBox(true, true);

            // Initialize auto crop area
            cropBox.width = min(max(cropBox.width, cropBox.minWidth), cropBox.maxWidth);
            cropBox.height = min(max(cropBox.height, cropBox.minHeight), cropBox.maxHeight);

            // The width of auto crop area must large than "minWidth", and the height too. (#164)
            cropBox.width = max(cropBox.minWidth, cropBox.width * autoCropArea);
            cropBox.height = max(cropBox.minHeight, cropBox.height * autoCropArea);
            cropBox.oldLeft = cropBox.left = canvas.left + (canvas.width - cropBox.width) / 2;
            cropBox.oldTop = cropBox.top = canvas.top + (canvas.height - cropBox.height) / 2;

            this.initialCropBox = $.extend({}, cropBox);
        },

        limitCropBox: function (isSizeLimited, isPositionLimited) {
            var options = this.options;
            var aspectRatio = options.aspectRatio;
            var container = this.container;
            var containerWidth = container.width;
            var containerHeight = container.height;
            var canvas = this.canvas;
            var cropBox = this.cropBox;
            var isLimited = this.isLimited;
            var minCropBoxWidth;
            var minCropBoxHeight;
            var maxCropBoxWidth;
            var maxCropBoxHeight;

            if (isSizeLimited) {
                minCropBoxWidth = num(options.minCropBoxWidth) || 0;
                minCropBoxHeight = num(options.minCropBoxHeight) || 0;

                // The min/maxCropBoxWidth/Height must be less than containerWidth/Height
                minCropBoxWidth = min(minCropBoxWidth, containerWidth);
                minCropBoxHeight = min(minCropBoxHeight, containerHeight);
                maxCropBoxWidth = min(containerWidth, isLimited ? canvas.width : containerWidth);
                maxCropBoxHeight = min(containerHeight, isLimited ? canvas.height : containerHeight);

                if (aspectRatio) {
                    if (minCropBoxWidth && minCropBoxHeight) {
                        if (minCropBoxHeight * aspectRatio > minCropBoxWidth) {
                            minCropBoxHeight = minCropBoxWidth / aspectRatio;
                        } else {
                            minCropBoxWidth = minCropBoxHeight * aspectRatio;
                        }
                    } else if (minCropBoxWidth) {
                        minCropBoxHeight = minCropBoxWidth / aspectRatio;
                    } else if (minCropBoxHeight) {
                        minCropBoxWidth = minCropBoxHeight * aspectRatio;
                    }

                    if (maxCropBoxHeight * aspectRatio > maxCropBoxWidth) {
                        maxCropBoxHeight = maxCropBoxWidth / aspectRatio;
                    } else {
                        maxCropBoxWidth = maxCropBoxHeight * aspectRatio;
                    }
                }

                // The minWidth/Height must be less than maxWidth/Height
                cropBox.minWidth = min(minCropBoxWidth, maxCropBoxWidth);
                cropBox.minHeight = min(minCropBoxHeight, maxCropBoxHeight);
                cropBox.maxWidth = maxCropBoxWidth;
                cropBox.maxHeight = maxCropBoxHeight;
            }

            if (isPositionLimited) {
                if (isLimited) {
                    cropBox.minLeft = max(0, canvas.left);
                    cropBox.minTop = max(0, canvas.top);
                    cropBox.maxLeft = min(containerWidth, canvas.left + canvas.width) - cropBox.width;
                    cropBox.maxTop = min(containerHeight, canvas.top + canvas.height) - cropBox.height;
                } else {
                    cropBox.minLeft = 0;
                    cropBox.minTop = 0;
                    cropBox.maxLeft = containerWidth - cropBox.width;
                    cropBox.maxTop = containerHeight - cropBox.height;
                }
            }
        },

        renderCropBox: function () {
            var options = this.options;
            var container = this.container;
            var containerWidth = container.width;
            var containerHeight = container.height;
            var cropBox = this.cropBox;

            if (cropBox.width > cropBox.maxWidth || cropBox.width < cropBox.minWidth) {
                cropBox.left = cropBox.oldLeft;
            }

            if (cropBox.height > cropBox.maxHeight || cropBox.height < cropBox.minHeight) {
                cropBox.top = cropBox.oldTop;
            }

            cropBox.width = min(max(cropBox.width, cropBox.minWidth), cropBox.maxWidth);
            cropBox.height = min(max(cropBox.height, cropBox.minHeight), cropBox.maxHeight);

            this.limitCropBox(false, true);

            cropBox.oldLeft = cropBox.left = min(max(cropBox.left, cropBox.minLeft), cropBox.maxLeft);
            cropBox.oldTop = cropBox.top = min(max(cropBox.top, cropBox.minTop), cropBox.maxTop);

            if (options.movable && options.cropBoxMovable) {

                // Turn to move the canvas when the crop box is equal to the container
                this.$face.data(DATA_ACTION, (cropBox.width === containerWidth && cropBox.height === containerHeight) ? ACTION_MOVE : ACTION_ALL);
            }

            this.$cropBox.css({
                width: cropBox.width,
                height: cropBox.height,
                left: cropBox.left,
                top: cropBox.top
            });

            if (this.isCropped && this.isLimited) {
                this.limitCanvas(true, true);
            }

            if (!this.isDisabled) {
                this.output();
            }
        },

        output: function () {
            this.preview();

            if (this.isCompleted) {
                this.trigger(EVENT_CROP, this.getData());
            }
        },

        initPreview: function () {
            var crossOrigin = getCrossOrigin(this.crossOrigin);
            var url = crossOrigin ? this.crossOriginUrl : this.url;
            var $clone2;

            this.$preview = $(this.options.preview);
            this.$clone2 = $clone2 = $('<img' + crossOrigin + ' src="' + url + '">');
            this.$viewBox.html($clone2);
            this.$preview.each(function () {
                var $this = $(this);

                // Save the original size for recover
                $this.data(DATA_PREVIEW, {
                    width: $this.width(),
                    height: $this.height(),
                    html: $this.html()
                });

                /**
                 * Override img element styles
                 * Add `display:block` to avoid margin top issue
                 * (Occur only when margin-top <= -height)
                 */
                $this.html(
                    '<img' + crossOrigin + ' src="' + url + '" style="' +
                    'display:block;width:100%;height:auto;' +
                    'min-width:0!important;min-height:0!important;' +
                    'max-width:none!important;max-height:none!important;' +
                    'image-orientation:0deg!important;">'
                );
            });
        },

        resetPreview: function () {
            this.$preview.each(function () {
                var $this = $(this);
                var data = $this.data(DATA_PREVIEW);

                $this.css({
                    width: data.width,
                    height: data.height
                }).html(data.html).removeData(DATA_PREVIEW);
            });
        },

        preview: function () {
            var image = this.image;
            var canvas = this.canvas;
            var cropBox = this.cropBox;
            var cropBoxWidth = cropBox.width;
            var cropBoxHeight = cropBox.height;
            var width = image.width;
            var height = image.height;
            var left = cropBox.left - canvas.left - image.left;
            var top = cropBox.top - canvas.top - image.top;

            if (!this.isCropped || this.isDisabled) {
                return;
            }

            this.$clone2.css({
                width: width,
                height: height,
                marginLeft: -left,
                marginTop: -top,
                transform: getTransform(image)
            });

            this.$preview.each(function () {
                var $this = $(this);
                var data = $this.data(DATA_PREVIEW);
                var originalWidth = data.width;
                var originalHeight = data.height;
                var newWidth = originalWidth;
                var newHeight = originalHeight;
                var ratio = 1;

                if (cropBoxWidth) {
                    ratio = originalWidth / cropBoxWidth;
                    newHeight = cropBoxHeight * ratio;
                }

                if (cropBoxHeight && newHeight > originalHeight) {
                    ratio = originalHeight / cropBoxHeight;
                    newWidth = cropBoxWidth * ratio;
                    newHeight = originalHeight;
                }

                $this.css({
                    width: newWidth,
                    height: newHeight
                }).find('img').css({
                    width: width * ratio,
                    height: height * ratio,
                    marginLeft: -left * ratio,
                    marginTop: -top * ratio,
                    transform: getTransform(image)
                });
            });
        },

        bind: function () {
            var options = this.options;
            var $this = this.$element;
            var $cropper = this.$cropper;

            if ($.isFunction(options.cropstart)) {
                $this.on(EVENT_CROP_START, options.cropstart);
            }

            if ($.isFunction(options.cropmove)) {
                $this.on(EVENT_CROP_MOVE, options.cropmove);
            }

            if ($.isFunction(options.cropend)) {
                $this.on(EVENT_CROP_END, options.cropend);
            }

            if ($.isFunction(options.crop)) {
                $this.on(EVENT_CROP, options.crop);
            }

            if ($.isFunction(options.zoom)) {
                $this.on(EVENT_ZOOM, options.zoom);
            }

            $cropper.on(EVENT_MOUSE_DOWN, $.proxy(this.cropStart, this));

            if (options.zoomable && options.zoomOnWheel) {
                $cropper.on(EVENT_WHEEL, $.proxy(this.wheel, this));
            }

            if (options.toggleDragModeOnDblclick) {
                $cropper.on(EVENT_DBLCLICK, $.proxy(this.dblclick, this));
            }

            $document.
            on(EVENT_MOUSE_MOVE, (this._cropMove = proxy(this.cropMove, this))).
            on(EVENT_MOUSE_UP, (this._cropEnd = proxy(this.cropEnd, this)));

            if (options.responsive) {
                $window.on(EVENT_RESIZE, (this._resize = proxy(this.resize, this)));
            }
        },

        unbind: function () {
            var options = this.options;
            var $this = this.$element;
            var $cropper = this.$cropper;

            if ($.isFunction(options.cropstart)) {
                $this.off(EVENT_CROP_START, options.cropstart);
            }

            if ($.isFunction(options.cropmove)) {
                $this.off(EVENT_CROP_MOVE, options.cropmove);
            }

            if ($.isFunction(options.cropend)) {
                $this.off(EVENT_CROP_END, options.cropend);
            }

            if ($.isFunction(options.crop)) {
                $this.off(EVENT_CROP, options.crop);
            }

            if ($.isFunction(options.zoom)) {
                $this.off(EVENT_ZOOM, options.zoom);
            }

            $cropper.off(EVENT_MOUSE_DOWN, this.cropStart);

            if (options.zoomable && options.zoomOnWheel) {
                $cropper.off(EVENT_WHEEL, this.wheel);
            }

            if (options.toggleDragModeOnDblclick) {
                $cropper.off(EVENT_DBLCLICK, this.dblclick);
            }

            $document.
            off(EVENT_MOUSE_MOVE, this._cropMove).
            off(EVENT_MOUSE_UP, this._cropEnd);

            if (options.responsive) {
                $window.off(EVENT_RESIZE, this._resize);
            }
        },

        resize: function () {
            var restore = this.options.restore;
            var $container = this.$container;
            var container = this.container;
            var canvasData;
            var cropBoxData;
            var ratio;

            // Check `container` is necessary for IE8
            if (this.isDisabled || !container) {
                return;
            }

            ratio = $container.width() / container.width;

            // Resize when width changed or height changed
            if (ratio !== 1 || $container.height() !== container.height) {
                if (restore) {
                    canvasData = this.getCanvasData();
                    cropBoxData = this.getCropBoxData();
                }

                this.render();

                if (restore) {
                    this.setCanvasData($.each(canvasData, function (i, n) {
                        canvasData[i] = n * ratio;
                    }));
                    this.setCropBoxData($.each(cropBoxData, function (i, n) {
                        cropBoxData[i] = n * ratio;
                    }));
                }
            }
        },

        dblclick: function () {
            if (this.isDisabled) {
                return;
            }

            if (this.$dragBox.hasClass(CLASS_CROP)) {
                this.setDragMode(ACTION_MOVE);
            } else {
                this.setDragMode(ACTION_CROP);
            }
        },

        wheel: function (event) {
            var e = event.originalEvent || event;
            var ratio = num(this.options.wheelZoomRatio) || 0.1;
            var delta = 1;

            if (this.isDisabled) {
                return;
            }

            event.preventDefault();

            // Limit wheel speed to prevent zoom too fast
            if (this.wheeling) {
                return;
            }

            this.wheeling = true;

            setTimeout($.proxy(function () {
                this.wheeling = false;
            }, this), 50);

            if (e.deltaY) {
                delta = e.deltaY > 0 ? 1 : -1;
            } else if (e.wheelDelta) {
                delta = -e.wheelDelta / 120;
            } else if (e.detail) {
                delta = e.detail > 0 ? 1 : -1;
            }

            this.zoom(-delta * ratio, event);
        },

        cropStart: function (event) {
            var options = this.options;
            var originalEvent = event.originalEvent;
            var touches = originalEvent && originalEvent.touches;
            var e = event;
            var touchesLength;
            var action;

            if (this.isDisabled) {
                return;
            }

            if (touches) {
                touchesLength = touches.length;

                if (touchesLength > 1) {
                    if (options.zoomable && options.zoomOnTouch && touchesLength === 2) {
                        e = touches[1];
                        this.startX2 = e.pageX;
                        this.startY2 = e.pageY;
                        action = ACTION_ZOOM;
                    } else {
                        return;
                    }
                }

                e = touches[0];
            }

            action = action || $(e.target).data(DATA_ACTION);

            if (REGEXP_ACTIONS.test(action)) {
                if (this.trigger(EVENT_CROP_START, {
                        originalEvent: originalEvent,
                        action: action
                    }).isDefaultPrevented()) {
                    return;
                }

                event.preventDefault();

                this.action = action;
                this.cropping = false;

                // IE8  has `event.pageX/Y`, but not `event.originalEvent.pageX/Y`
                // IE10 has `event.originalEvent.pageX/Y`, but not `event.pageX/Y`
                this.startX = e.pageX || originalEvent && originalEvent.pageX;
                this.startY = e.pageY || originalEvent && originalEvent.pageY;

                if (action === ACTION_CROP) {
                    this.cropping = true;
                    this.$dragBox.addClass(CLASS_MODAL);
                }
            }
        },

        cropMove: function (event) {
            var options = this.options;
            var originalEvent = event.originalEvent;
            var touches = originalEvent && originalEvent.touches;
            var e = event;
            var action = this.action;
            var touchesLength;

            if (this.isDisabled) {
                return;
            }

            if (touches) {
                touchesLength = touches.length;

                if (touchesLength > 1) {
                    if (options.zoomable && options.zoomOnTouch && touchesLength === 2) {
                        e = touches[1];
                        this.endX2 = e.pageX;
                        this.endY2 = e.pageY;
                    } else {
                        return;
                    }
                }

                e = touches[0];
            }

            if (action) {
                if (this.trigger(EVENT_CROP_MOVE, {
                        originalEvent: originalEvent,
                        action: action
                    }).isDefaultPrevented()) {
                    return;
                }

                event.preventDefault();

                this.endX = e.pageX || originalEvent && originalEvent.pageX;
                this.endY = e.pageY || originalEvent && originalEvent.pageY;

                this.change(e.shiftKey, action === ACTION_ZOOM ? event : null);
            }
        },

        cropEnd: function (event) {
            var originalEvent = event.originalEvent;
            var action = this.action;

            if (this.isDisabled) {
                return;
            }

            if (action) {
                event.preventDefault();

                if (this.cropping) {
                    this.cropping = false;
                    this.$dragBox.toggleClass(CLASS_MODAL, this.isCropped && this.options.modal);
                }

                this.action = '';

                this.trigger(EVENT_CROP_END, {
                    originalEvent: originalEvent,
                    action: action
                });
            }
        },

        change: function (shiftKey, event) {
            var options = this.options;
            var aspectRatio = options.aspectRatio;
            var action = this.action;
            var container = this.container;
            var canvas = this.canvas;
            var cropBox = this.cropBox;
            var width = cropBox.width;
            var height = cropBox.height;
            var left = cropBox.left;
            var top = cropBox.top;
            var right = left + width;
            var bottom = top + height;
            var minLeft = 0;
            var minTop = 0;
            var maxWidth = container.width;
            var maxHeight = container.height;
            var renderable = true;
            var offset;
            var range;

            // Locking aspect ratio in "free mode" by holding shift key (#259)
            if (!aspectRatio && shiftKey) {
                aspectRatio = width && height ? width / height : 1;
            }

            if (this.isLimited) {
                minLeft = cropBox.minLeft;
                minTop = cropBox.minTop;
                maxWidth = minLeft + min(container.width, canvas.width, canvas.left + canvas.width);
                maxHeight = minTop + min(container.height, canvas.height, canvas.top + canvas.height);
            }

            range = {
                x: this.endX - this.startX,
                y: this.endY - this.startY
            };

            if (aspectRatio) {
                range.X = range.y * aspectRatio;
                range.Y = range.x / aspectRatio;
            }

            switch (action) {
                // Move crop box
                case ACTION_ALL:
                    left += range.x;
                    top += range.y;
                    break;

                // Resize crop box
                case ACTION_EAST:
                    if (range.x >= 0 && (right >= maxWidth || aspectRatio &&
                        (top <= minTop || bottom >= maxHeight))) {

                        renderable = false;
                        break;
                    }

                    width += range.x;

                    if (aspectRatio) {
                        height = width / aspectRatio;
                        top -= range.Y / 2;
                    }

                    if (width < 0) {
                        action = ACTION_WEST;
                        width = 0;
                    }

                    break;

                case ACTION_NORTH:
                    if (range.y <= 0 && (top <= minTop || aspectRatio &&
                        (left <= minLeft || right >= maxWidth))) {

                        renderable = false;
                        break;
                    }

                    height -= range.y;
                    top += range.y;

                    if (aspectRatio) {
                        width = height * aspectRatio;
                        left += range.X / 2;
                    }

                    if (height < 0) {
                        action = ACTION_SOUTH;
                        height = 0;
                    }

                    break;

                case ACTION_WEST:
                    if (range.x <= 0 && (left <= minLeft || aspectRatio &&
                        (top <= minTop || bottom >= maxHeight))) {

                        renderable = false;
                        break;
                    }

                    width -= range.x;
                    left += range.x;

                    if (aspectRatio) {
                        height = width / aspectRatio;
                        top += range.Y / 2;
                    }

                    if (width < 0) {
                        action = ACTION_EAST;
                        width = 0;
                    }

                    break;

                case ACTION_SOUTH:
                    if (range.y >= 0 && (bottom >= maxHeight || aspectRatio &&
                        (left <= minLeft || right >= maxWidth))) {

                        renderable = false;
                        break;
                    }

                    height += range.y;

                    if (aspectRatio) {
                        width = height * aspectRatio;
                        left -= range.X / 2;
                    }

                    if (height < 0) {
                        action = ACTION_NORTH;
                        height = 0;
                    }

                    break;

                case ACTION_NORTH_EAST:
                    if (aspectRatio) {
                        if (range.y <= 0 && (top <= minTop || right >= maxWidth)) {
                            renderable = false;
                            break;
                        }

                        height -= range.y;
                        top += range.y;
                        width = height * aspectRatio;
                    } else {
                        if (range.x >= 0) {
                            if (right < maxWidth) {
                                width += range.x;
                            } else if (range.y <= 0 && top <= minTop) {
                                renderable = false;
                            }
                        } else {
                            width += range.x;
                        }

                        if (range.y <= 0) {
                            if (top > minTop) {
                                height -= range.y;
                                top += range.y;
                            }
                        } else {
                            height -= range.y;
                            top += range.y;
                        }
                    }

                    if (width < 0 && height < 0) {
                        action = ACTION_SOUTH_WEST;
                        height = 0;
                        width = 0;
                    } else if (width < 0) {
                        action = ACTION_NORTH_WEST;
                        width = 0;
                    } else if (height < 0) {
                        action = ACTION_SOUTH_EAST;
                        height = 0;
                    }

                    break;

                case ACTION_NORTH_WEST:
                    if (aspectRatio) {
                        if (range.y <= 0 && (top <= minTop || left <= minLeft)) {
                            renderable = false;
                            break;
                        }

                        height -= range.y;
                        top += range.y;
                        width = height * aspectRatio;
                        left += range.X;
                    } else {
                        if (range.x <= 0) {
                            if (left > minLeft) {
                                width -= range.x;
                                left += range.x;
                            } else if (range.y <= 0 && top <= minTop) {
                                renderable = false;
                            }
                        } else {
                            width -= range.x;
                            left += range.x;
                        }

                        if (range.y <= 0) {
                            if (top > minTop) {
                                height -= range.y;
                                top += range.y;
                            }
                        } else {
                            height -= range.y;
                            top += range.y;
                        }
                    }

                    if (width < 0 && height < 0) {
                        action = ACTION_SOUTH_EAST;
                        height = 0;
                        width = 0;
                    } else if (width < 0) {
                        action = ACTION_NORTH_EAST;
                        width = 0;
                    } else if (height < 0) {
                        action = ACTION_SOUTH_WEST;
                        height = 0;
                    }

                    break;

                case ACTION_SOUTH_WEST:
                    if (aspectRatio) {
                        if (range.x <= 0 && (left <= minLeft || bottom >= maxHeight)) {
                            renderable = false;
                            break;
                        }

                        width -= range.x;
                        left += range.x;
                        height = width / aspectRatio;
                    } else {
                        if (range.x <= 0) {
                            if (left > minLeft) {
                                width -= range.x;
                                left += range.x;
                            } else if (range.y >= 0 && bottom >= maxHeight) {
                                renderable = false;
                            }
                        } else {
                            width -= range.x;
                            left += range.x;
                        }

                        if (range.y >= 0) {
                            if (bottom < maxHeight) {
                                height += range.y;
                            }
                        } else {
                            height += range.y;
                        }
                    }

                    if (width < 0 && height < 0) {
                        action = ACTION_NORTH_EAST;
                        height = 0;
                        width = 0;
                    } else if (width < 0) {
                        action = ACTION_SOUTH_EAST;
                        width = 0;
                    } else if (height < 0) {
                        action = ACTION_NORTH_WEST;
                        height = 0;
                    }

                    break;

                case ACTION_SOUTH_EAST:
                    if (aspectRatio) {
                        if (range.x >= 0 && (right >= maxWidth || bottom >= maxHeight)) {
                            renderable = false;
                            break;
                        }

                        width += range.x;
                        height = width / aspectRatio;
                    } else {
                        if (range.x >= 0) {
                            if (right < maxWidth) {
                                width += range.x;
                            } else if (range.y >= 0 && bottom >= maxHeight) {
                                renderable = false;
                            }
                        } else {
                            width += range.x;
                        }

                        if (range.y >= 0) {
                            if (bottom < maxHeight) {
                                height += range.y;
                            }
                        } else {
                            height += range.y;
                        }
                    }

                    if (width < 0 && height < 0) {
                        action = ACTION_NORTH_WEST;
                        height = 0;
                        width = 0;
                    } else if (width < 0) {
                        action = ACTION_SOUTH_WEST;
                        width = 0;
                    } else if (height < 0) {
                        action = ACTION_NORTH_EAST;
                        height = 0;
                    }

                    break;

                // Move canvas
                case ACTION_MOVE:
                    this.move(range.x, range.y);
                    renderable = false;
                    break;

                // Zoom canvas
                case ACTION_ZOOM:
                    this.zoom((function (x1, y1, x2, y2) {
                        var z1 = sqrt(x1 * x1 + y1 * y1);
                        var z2 = sqrt(x2 * x2 + y2 * y2);

                        return (z2 - z1) / z1;
                    })(
                        abs(this.startX - this.startX2),
                        abs(this.startY - this.startY2),
                        abs(this.endX - this.endX2),
                        abs(this.endY - this.endY2)
                    ), event);
                    this.startX2 = this.endX2;
                    this.startY2 = this.endY2;
                    renderable = false;
                    break;

                // Create crop box
                case ACTION_CROP:
                    if (!range.x || !range.y) {
                        renderable = false;
                        break;
                    }

                    offset = this.$cropper.offset();
                    left = this.startX - offset.left;
                    top = this.startY - offset.top;
                    width = cropBox.minWidth;
                    height = cropBox.minHeight;

                    if (range.x > 0) {
                        action = range.y > 0 ? ACTION_SOUTH_EAST : ACTION_NORTH_EAST;
                    } else if (range.x < 0) {
                        left -= width;
                        action = range.y > 0 ? ACTION_SOUTH_WEST : ACTION_NORTH_WEST;
                    }

                    if (range.y < 0) {
                        top -= height;
                    }

                    // Show the crop box if is hidden
                    if (!this.isCropped) {
                        this.$cropBox.removeClass(CLASS_HIDDEN);
                        this.isCropped = true;

                        if (this.isLimited) {
                            this.limitCropBox(true, true);
                        }
                    }

                    break;

                // No default
            }

            if (renderable) {
                cropBox.width = width;
                cropBox.height = height;
                cropBox.left = left;
                cropBox.top = top;
                this.action = action;

                this.renderCropBox();
            }

            // Override
            this.startX = this.endX;
            this.startY = this.endY;
        },

        // Show the crop box manually
        crop: function () {
            if (!this.isBuilt || this.isDisabled) {
                return;
            }

            if (!this.isCropped) {
                this.isCropped = true;
                this.limitCropBox(true, true);

                if (this.options.modal) {
                    this.$dragBox.addClass(CLASS_MODAL);
                }

                this.$cropBox.removeClass(CLASS_HIDDEN);
            }

            this.setCropBoxData(this.initialCropBox);
        },

        // Reset the image and crop box to their initial states
        reset: function () {
            if (!this.isBuilt || this.isDisabled) {
                return;
            }

            this.image = $.extend({}, this.initialImage);
            this.canvas = $.extend({}, this.initialCanvas);
            this.cropBox = $.extend({}, this.initialCropBox);

            this.renderCanvas();

            if (this.isCropped) {
                this.renderCropBox();
            }
        },

        // Clear the crop box
        clear: function () {
            if (!this.isCropped || this.isDisabled) {
                return;
            }

            $.extend(this.cropBox, {
                left: 0,
                top: 0,
                width: 0,
                height: 0
            });

            this.isCropped = false;
            this.renderCropBox();

            this.limitCanvas(true, true);

            // Render canvas after crop box rendered
            this.renderCanvas();

            this.$dragBox.removeClass(CLASS_MODAL);
            this.$cropBox.addClass(CLASS_HIDDEN);
        },

        /**
         * Replace the image's src and rebuild the cropper
         *
         * @param {String} url
         * @param {Boolean} onlyColorChanged (optional)
         */
        replace: function (url, onlyColorChanged) {
            if (!this.isDisabled && url) {
                if (this.isImg) {
                    this.$element.attr('src', url);
                }

                if (onlyColorChanged) {
                    this.url = url;
                    this.$clone.attr('src', url);

                    if (this.isBuilt) {
                        this.$preview.find('img').add(this.$clone2).attr('src', url);
                    }
                } else {
                    if (this.isImg) {
                        this.isReplaced = true;
                    }

                    // Clear previous data
                    this.options.data = null;
                    this.load(url);
                }
            }
        },

        // Enable (unfreeze) the cropper
        enable: function () {
            if (this.isBuilt) {
                this.isDisabled = false;
                this.$cropper.removeClass(CLASS_DISABLED);
            }
        },

        // Disable (freeze) the cropper
        disable: function () {
            if (this.isBuilt) {
                this.isDisabled = true;
                this.$cropper.addClass(CLASS_DISABLED);
            }
        },

        // Destroy the cropper and remove the instance from the image
        destroy: function () {
            var $this = this.$element;

            if (this.isLoaded) {
                if (this.isImg && this.isReplaced) {
                    $this.attr('src', this.originalUrl);
                }

                this.unbuild();
                $this.removeClass(CLASS_HIDDEN);
            } else {
                if (this.isImg) {
                    $this.off(EVENT_LOAD, this.start);
                } else if (this.$clone) {
                    this.$clone.remove();
                }
            }

            $this.removeData(NAMESPACE);
        },

        /**
         * Move the canvas with relative offsets
         *
         * @param {Number} offsetX
         * @param {Number} offsetY (optional)
         */
        move: function (offsetX, offsetY) {
            var canvas = this.canvas;

            this.moveTo(
                isUndefined(offsetX) ? offsetX : canvas.left + num(offsetX),
                isUndefined(offsetY) ? offsetY : canvas.top + num(offsetY)
            );
        },

        /**
         * Move the canvas to an absolute point
         *
         * @param {Number} x
         * @param {Number} y (optional)
         */
        moveTo: function (x, y) {
            var canvas = this.canvas;
            var isChanged = false;

            // If "y" is not present, its default value is "x"
            if (isUndefined(y)) {
                y = x;
            }

            x = num(x);
            y = num(y);

            if (this.isBuilt && !this.isDisabled && this.options.movable) {
                if (isNumber(x)) {
                    canvas.left = x;
                    isChanged = true;
                }

                if (isNumber(y)) {
                    canvas.top = y;
                    isChanged = true;
                }

                if (isChanged) {
                    this.renderCanvas(true);
                }
            }
        },

        /**
         * Zoom the canvas with a relative ratio
         *
         * @param {Number} ratio
         * @param {jQuery Event} _event (private)
         */
        zoom: function (ratio, _event) {
            var canvas = this.canvas;

            ratio = num(ratio);

            if (ratio < 0) {
                ratio =  1 / (1 - ratio);
            } else {
                ratio = 1 + ratio;
            }

            this.zoomTo(canvas.width * ratio / canvas.naturalWidth, _event);
        },

        /**
         * Zoom the canvas to an absolute ratio
         *
         * @param {Number} ratio
         * @param {jQuery Event} _event (private)
         */
        zoomTo: function (ratio, _event) {
            var options = this.options;
            var canvas = this.canvas;
            var width = canvas.width;
            var height = canvas.height;
            var naturalWidth = canvas.naturalWidth;
            var naturalHeight = canvas.naturalHeight;
            var originalEvent;
            var newWidth;
            var newHeight;
            var offset;
            var center;

            ratio = num(ratio);

            if (ratio >= 0 && this.isBuilt && !this.isDisabled && options.zoomable) {
                newWidth = naturalWidth * ratio;
                newHeight = naturalHeight * ratio;

                if (_event) {
                    originalEvent = _event.originalEvent;
                }

                if (this.trigger(EVENT_ZOOM, {
                        originalEvent: originalEvent,
                        oldRatio: width / naturalWidth,
                        ratio: newWidth / naturalWidth
                    }).isDefaultPrevented()) {
                    return;
                }

                if (originalEvent) {
                    offset = this.$cropper.offset();
                    center = originalEvent.touches ? getTouchesCenter(originalEvent.touches) : {
                        pageX: _event.pageX || originalEvent.pageX || 0,
                        pageY: _event.pageY || originalEvent.pageY || 0
                    };

                    // Zoom from the triggering point of the event
                    canvas.left -= (newWidth - width) * (
                            ((center.pageX - offset.left) - canvas.left) / width
                        );
                    canvas.top -= (newHeight - height) * (
                            ((center.pageY - offset.top) - canvas.top) / height
                        );
                } else {

                    // Zoom from the center of the canvas
                    canvas.left -= (newWidth - width) / 2;
                    canvas.top -= (newHeight - height) / 2;
                }

                canvas.width = newWidth;
                canvas.height = newHeight;
                this.renderCanvas(true);
            }
        },

        /**
         * Rotate the canvas with a relative degree
         *
         * @param {Number} degree
         */
        rotate: function (degree) {
            this.rotateTo((this.image.rotate || 0) + num(degree));
        },

        /**
         * Rotate the canvas to an absolute degree
         * https://developer.mozilla.org/en-US/docs/Web/CSS/transform-function#rotate()
         *
         * @param {Number} degree
         */
        rotateTo: function (degree) {
            degree = num(degree);

            if (isNumber(degree) && this.isBuilt && !this.isDisabled && this.options.rotatable) {
                this.image.rotate = degree % 360;
                this.isRotated = true;
                this.renderCanvas(true);
            }
        },

        /**
         * Scale the image
         * https://developer.mozilla.org/en-US/docs/Web/CSS/transform-function#scale()
         *
         * @param {Number} scaleX
         * @param {Number} scaleY (optional)
         */
        scale: function (scaleX, scaleY) {
            var image = this.image;
            var isChanged = false;

            // If "scaleY" is not present, its default value is "scaleX"
            if (isUndefined(scaleY)) {
                scaleY = scaleX;
            }

            scaleX = num(scaleX);
            scaleY = num(scaleY);

            if (this.isBuilt && !this.isDisabled && this.options.scalable) {
                if (isNumber(scaleX)) {
                    image.scaleX = scaleX;
                    isChanged = true;
                }

                if (isNumber(scaleY)) {
                    image.scaleY = scaleY;
                    isChanged = true;
                }

                if (isChanged) {
                    this.renderImage(true);
                }
            }
        },

        /**
         * Scale the abscissa of the image
         *
         * @param {Number} scaleX
         */
        scaleX: function (scaleX) {
            var scaleY = this.image.scaleY;

            this.scale(scaleX, isNumber(scaleY) ? scaleY : 1);
        },

        /**
         * Scale the ordinate of the image
         *
         * @param {Number} scaleY
         */
        scaleY: function (scaleY) {
            var scaleX = this.image.scaleX;

            this.scale(isNumber(scaleX) ? scaleX : 1, scaleY);
        },

        /**
         * Get the cropped area position and size data (base on the original image)
         *
         * @param {Boolean} isRounded (optional)
         * @return {Object} data
         */
        getData: function (isRounded) {
            var options = this.options;
            var image = this.image;
            var canvas = this.canvas;
            var cropBox = this.cropBox;
            var ratio;
            var data;

            if (this.isBuilt && this.isCropped) {
                data = {
                    x: cropBox.left - canvas.left,
                    y: cropBox.top - canvas.top,
                    width: cropBox.width,
                    height: cropBox.height
                };

                ratio = image.width / image.naturalWidth;

                $.each(data, function (i, n) {
                    n = n / ratio;
                    data[i] = isRounded ? round(n) : n;
                });

            } else {
                data = {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0
                };
            }

            if (options.rotatable) {
                data.rotate = image.rotate || 0;
            }

            if (options.scalable) {
                data.scaleX = image.scaleX || 1;
                data.scaleY = image.scaleY || 1;
            }

            return data;
        },

        /**
         * Set the cropped area position and size with new data
         *
         * @param {Object} data
         */
        setData: function (data) {
            var options = this.options;
            var image = this.image;
            var canvas = this.canvas;
            var cropBoxData = {};
            var isRotated;
            var isScaled;
            var ratio;

            if ($.isFunction(data)) {
                data = data.call(this.element);
            }

            if (this.isBuilt && !this.isDisabled && $.isPlainObject(data)) {
                if (options.rotatable) {
                    if (isNumber(data.rotate) && data.rotate !== image.rotate) {
                        image.rotate = data.rotate;
                        this.isRotated = isRotated = true;
                    }
                }

                if (options.scalable) {
                    if (isNumber(data.scaleX) && data.scaleX !== image.scaleX) {
                        image.scaleX = data.scaleX;
                        isScaled = true;
                    }

                    if (isNumber(data.scaleY) && data.scaleY !== image.scaleY) {
                        image.scaleY = data.scaleY;
                        isScaled = true;
                    }
                }

                if (isRotated) {
                    this.renderCanvas();
                } else if (isScaled) {
                    this.renderImage();
                }

                ratio = image.width / image.naturalWidth;

                if (isNumber(data.x)) {
                    cropBoxData.left = data.x * ratio + canvas.left;
                }

                if (isNumber(data.y)) {
                    cropBoxData.top = data.y * ratio + canvas.top;
                }

                if (isNumber(data.width)) {
                    cropBoxData.width = data.width * ratio;
                }

                if (isNumber(data.height)) {
                    cropBoxData.height = data.height * ratio;
                }

                this.setCropBoxData(cropBoxData);
            }
        },

        /**
         * Get the container size data
         *
         * @return {Object} data
         */
        getContainerData: function () {
            return this.isBuilt ? this.container : {};
        },

        /**
         * Get the image position and size data
         *
         * @return {Object} data
         */
        getImageData: function () {
            return this.isLoaded ? this.image : {};
        },

        /**
         * Get the canvas position and size data
         *
         * @return {Object} data
         */
        getCanvasData: function () {
            var canvas = this.canvas;
            var data = {};

            if (this.isBuilt) {
                $.each([
                    'left',
                    'top',
                    'width',
                    'height',
                    'naturalWidth',
                    'naturalHeight'
                ], function (i, n) {
                    data[n] = canvas[n];
                });
            }

            return data;
        },

        /**
         * Set the canvas position and size with new data
         *
         * @param {Object} data
         */
        setCanvasData: function (data) {
            var canvas = this.canvas;
            var aspectRatio = canvas.aspectRatio;

            if ($.isFunction(data)) {
                data = data.call(this.$element);
            }

            if (this.isBuilt && !this.isDisabled && $.isPlainObject(data)) {
                if (isNumber(data.left)) {
                    canvas.left = data.left;
                }

                if (isNumber(data.top)) {
                    canvas.top = data.top;
                }

                if (isNumber(data.width)) {
                    canvas.width = data.width;
                    canvas.height = data.width / aspectRatio;
                } else if (isNumber(data.height)) {
                    canvas.height = data.height;
                    canvas.width = data.height * aspectRatio;
                }

                this.renderCanvas(true);
            }
        },

        /**
         * Get the crop box position and size data
         *
         * @return {Object} data
         */
        getCropBoxData: function () {
            var cropBox = this.cropBox;
            var data;

            if (this.isBuilt && this.isCropped) {
                data = {
                    left: cropBox.left,
                    top: cropBox.top,
                    width: cropBox.width,
                    height: cropBox.height
                };
            }

            return data || {};
        },

        /**
         * Set the crop box position and size with new data
         *
         * @param {Object} data
         */
        setCropBoxData: function (data) {
            var cropBox = this.cropBox;
            var aspectRatio = this.options.aspectRatio;
            var isWidthChanged;
            var isHeightChanged;

            if ($.isFunction(data)) {
                data = data.call(this.$element);
            }

            if (this.isBuilt && this.isCropped && !this.isDisabled && $.isPlainObject(data)) {

                if (isNumber(data.left)) {
                    cropBox.left = data.left;
                }

                if (isNumber(data.top)) {
                    cropBox.top = data.top;
                }

                if (isNumber(data.width)) {
                    isWidthChanged = true;
                    cropBox.width = data.width;
                }

                if (isNumber(data.height)) {
                    isHeightChanged = true;
                    cropBox.height = data.height;
                }

                if (aspectRatio) {
                    if (isWidthChanged) {
                        cropBox.height = cropBox.width / aspectRatio;
                    } else if (isHeightChanged) {
                        cropBox.width = cropBox.height * aspectRatio;
                    }
                }

                this.renderCropBox();
            }
        },

        /**
         * Get a canvas drawn the cropped image
         *
         * @param {Object} options (optional)
         * @return {HTMLCanvasElement} canvas
         */
        getCroppedCanvas: function (options) {
            var originalWidth;
            var originalHeight;
            var canvasWidth;
            var canvasHeight;
            var scaledWidth;
            var scaledHeight;
            var scaledRatio;
            var aspectRatio;
            var canvas;
            var context;
            var data;

            if (!this.isBuilt || !SUPPORT_CANVAS) {
                return;
            }

            if (!this.isCropped) {
                return getSourceCanvas(this.$clone[0], this.image);
            }

            if (!$.isPlainObject(options)) {
                options = {};
            }

            data = this.getData();
            originalWidth = data.width;
            originalHeight = data.height;
            aspectRatio = originalWidth / originalHeight;

            if ($.isPlainObject(options)) {
                scaledWidth = options.width;
                scaledHeight = options.height;
                if(scaledWidth && scaledHeight){
                    scaledRatio = scaledWidth / originalWidth;
                }else if (scaledWidth) {
                    scaledHeight = scaledWidth / aspectRatio;
                    scaledRatio = scaledWidth / originalWidth;
                } else if (scaledHeight) {
                    scaledWidth = scaledHeight * aspectRatio;
                    scaledRatio = scaledHeight / originalHeight;
                }
            }

            // The canvas element will use `Math.floor` on a float number, so floor first
            canvasWidth = floor(scaledWidth || originalWidth);
            canvasHeight = floor(scaledHeight || originalHeight);

            canvas = $('<canvas>')[0];
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            context = canvas.getContext('2d');
            if (options.fillColor) {
                context.fillStyle = options.fillColor;
                context.fillRect(0, 0, canvasWidth, canvasHeight);
            }

            // https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D.drawImage
            context.drawImage.apply(context, (function () {
                var source = getSourceCanvas(this.$clone[0], this.image);
                var sourceWidth = source.width;
                var sourceHeight = source.height;
                var canvas = this.canvas;
                var params = [source];

                // Source canvas
                var srcX = data.x + canvas.naturalWidth * (abs(data.scaleX || 1) - 1) / 2;
                var srcY = data.y + canvas.naturalHeight * (abs(data.scaleY || 1) - 1) / 2;
                var srcWidth;
                var srcHeight;

                // Destination canvas
                var dstX;
                var dstY;
                var dstWidth;
                var dstHeight;

                if (srcX <= -originalWidth || srcX > sourceWidth) {
                    srcX = srcWidth = dstX = dstWidth = 0;
                } else if (srcX <= 0) {
                    dstX = -srcX;
                    srcX = 0;
                    srcWidth = dstWidth = min(sourceWidth, originalWidth + srcX);
                } else if (srcX <= sourceWidth) {
                    dstX = 0;
                    srcWidth = dstWidth = min(originalWidth, sourceWidth - srcX);
                }

                if (srcWidth <= 0 || srcY <= -originalHeight || srcY > sourceHeight) {
                    srcY = srcHeight = dstY = dstHeight = 0;
                } else if (srcY <= 0) {
                    dstY = -srcY;
                    srcY = 0;
                    srcHeight = dstHeight = min(sourceHeight, originalHeight + srcY);
                } else if (srcY <= sourceHeight) {
                    dstY = 0;
                    srcHeight = dstHeight = min(originalHeight, sourceHeight - srcY);
                }

                // All the numerical parameters should be integer for `drawImage` (#476)
                params.push(floor(srcX), floor(srcY), floor(srcWidth), floor(srcHeight));

                // Scale destination sizes
                if (scaledRatio) {
                    dstX *= scaledRatio;
                    dstY *= scaledRatio;
                    dstWidth *= scaledRatio;
                    dstHeight *= scaledRatio;
                }

                // Avoid "IndexSizeError" in IE and Firefox
                if (dstWidth > 0 && dstHeight > 0) {
                    params.push(floor(dstX), floor(dstY), floor(dstWidth), floor(dstHeight));
                }
                return params;
            }).call(this));
            return canvas;
        },

        /**
         * Change the aspect ratio of the crop box
         *
         * @param {Number} aspectRatio
         */
        setAspectRatio: function (aspectRatio) {
            var options = this.options;

            if (!this.isDisabled && !isUndefined(aspectRatio)) {

                // 0 -> NaN
                options.aspectRatio = max(0, aspectRatio) || NaN;

                if (this.isBuilt) {
                    this.initCropBox();

                    if (this.isCropped) {
                        this.renderCropBox();
                    }
                }
            }
        },

        /**
         * Change the drag mode
         *
         * @param {String} mode (optional)
         */
        setDragMode: function (mode) {
            var options = this.options;
            var croppable;
            var movable;

            if (this.isLoaded && !this.isDisabled) {
                croppable = mode === ACTION_CROP;
                movable = options.movable && mode === ACTION_MOVE;
                mode = (croppable || movable) ? mode : ACTION_NONE;

                this.$dragBox.
                data(DATA_ACTION, mode).
                toggleClass(CLASS_CROP, croppable).
                toggleClass(CLASS_MOVE, movable);

                if (!options.cropBoxMovable) {

                    // Sync drag mode to crop box when it is not movable(#300)
                    this.$face.
                    data(DATA_ACTION, mode).
                    toggleClass(CLASS_CROP, croppable).
                    toggleClass(CLASS_MOVE, movable);
                }
            }
        }
    };

    Cropper.DEFAULTS = {

        // Define the view mode of the cropper
        viewMode: 0, // 0, 1, 2, 3

        // Define the dragging mode of the cropper
        dragMode: 'crop', // 'crop', 'move' or 'none'

        // Define the aspect ratio of the crop box
        aspectRatio: NaN,

        // An object with the previous cropping result data
        data: null,

        // A jQuery selector for adding extra containers to preview
        preview: '',

        // Re-render the cropper when resize the window
        responsive: true,

        // Restore the cropped area after resize the window
        restore: true,

        // Check if the current image is a cross-origin image
        checkCrossOrigin: true,

        // Check the current image's Exif Orientation information
        checkOrientation: true,

        // Show the black modal
        modal: true,

        // Show the dashed lines for guiding
        guides: true,

        // Show the center indicator for guiding
        center: true,

        // Show the white modal to highlight the crop box
        highlight: true,

        // Show the grid background
        background: true,

        // Enable to crop the image automatically when initialize
        autoCrop: true,

        // Define the percentage of automatic cropping area when initializes
        autoCropArea: 0.8,

        // Enable to move the image
        movable: true,

        // Enable to rotate the image
        rotatable: true,

        // Enable to scale the image
        scalable: true,

        // Enable to zoom the image
        zoomable: true,

        // Enable to zoom the image by dragging touch
        zoomOnTouch: true,

        // Enable to zoom the image by wheeling mouse
        zoomOnWheel: true,

        // Define zoom ratio when zoom the image by wheeling mouse
        wheelZoomRatio: 0.1,

        // Enable to move the crop box
        cropBoxMovable: true,

        // Enable to resize the crop box
        cropBoxResizable: true,

        // Toggle drag mode between "crop" and "move" when click twice on the cropper
        toggleDragModeOnDblclick: true,

        // Size limitation
        minCanvasWidth: 0,
        minCanvasHeight: 0,
        minCropBoxWidth: 0,
        minCropBoxHeight: 0,
        minContainerWidth: 200,
        minContainerHeight: 100,

        // Shortcuts of events
        build: null,
        built: null,
        cropstart: null,
        cropmove: null,
        cropend: null,
        crop: null,
        zoom: null
    };

    Cropper.setDefaults = function (options) {
        $.extend(Cropper.DEFAULTS, options);
    };

    Cropper.TEMPLATE = (
        '<div class="cropper-container">' +
        '<div class="cropper-wrap-box">' +
        '<div class="cropper-canvas"></div>' +
        '</div>' +
        '<div class="cropper-drag-box"></div>' +
        '<div class="cropper-crop-box">' +
        '<span class="cropper-view-box"></span>' +
        '<span class="cropper-dashed dashed-h"></span>' +
        '<span class="cropper-dashed dashed-v"></span>' +
        '<span class="cropper-center"></span>' +
        '<span class="cropper-face"></span>' +
        '<span class="cropper-line line-e" data-action="e"></span>' +
        '<span class="cropper-line line-n" data-action="n"></span>' +
        '<span class="cropper-line line-w" data-action="w"></span>' +
        '<span class="cropper-line line-s" data-action="s"></span>' +
        '<span class="cropper-point point-e" data-action="e"></span>' +
        '<span class="cropper-point point-n" data-action="n"></span>' +
        '<span class="cropper-point point-w" data-action="w"></span>' +
        '<span class="cropper-point point-s" data-action="s"></span>' +
        '<span class="cropper-point point-ne" data-action="ne"></span>' +
        '<span class="cropper-point point-nw" data-action="nw"></span>' +
        '<span class="cropper-point point-sw" data-action="sw"></span>' +
        '<span class="cropper-point point-se" data-action="se"></span>' +
        '</div>' +
        '</div>'
    );

    // Save the other cropper
    Cropper.other = $.fn.cropper;

    // Register as jQuery plugin
    $.fn.cropper = function (option) {
        var args = toArray(arguments, 1);
        var result;

        this.each(function () {
            var $this = $(this);
            var data = $this.data(NAMESPACE);
            var options;
            var fn;

            if (!data) {
                if (/destroy/.test(option)) {
                    return;
                }

                options = $.extend({}, $this.data(), $.isPlainObject(option) && option);
                $this.data(NAMESPACE, (data = new Cropper(this, options)));
            }

            if (typeof option === 'string' && $.isFunction(fn = data[option])) {
                result = fn.apply(data, args);
            }
        });

        return isUndefined(result) ? this : result;
    };

    $.fn.cropper.Constructor = Cropper;
    $.fn.cropper.setDefaults = Cropper.setDefaults;

    // No conflict
    $.fn.cropper.noConflict = function () {
        $.fn.cropper = Cropper.other;
        return this;
    };

});

/*
 * PLUGIN FOR SHOW LINK CONTENTS INTO MODAL
 * add events to links for open their content by ajax into modal
 * use: <a class='my_link' href='mylink' title='my title' data-show_footer='true'>
 * $(".my_link").ajax_modal({settings});
 * settings: check open_modal(settings)
 */

jQuery(function(){
    $.fn.ajax_modal = function(settings){
        $(this).click(function(e){
            var title = $(this).attr("title");
            title = (title == "")? $(this).attr("data-original-title") : title
            var def = {title: title?title:$(this).data("title"), mode: "ajax", url: $(this).attr("href"), show_footer: $(this).data("show_footer")};
            if($(this).attr('data-modal_size')) def["modal_size"] = $(this).attr('data-modal_size');
            var c_settings = $.extend({}, def, settings);
            open_modal(c_settings);
            e.preventDefault();
        });
        return this;
    }

    // custom alert dialog
    // show a custom modal box with messages
    // sample: $.fn.alert({type: 'error', content: 'My error', title: "My Title"})
    // type: error | warning | success
    $.fn.alert = function (options) {
        hideLoading();
        var default_options = {title: I18n("msg.updated_success"), type: "success", zindex: '99999999', id: 'cama_alert_modal' };
        options = $.extend(default_options, options || {});
        if(options.type == "error") options.type = "danger";
        if(options.type == "alert") options.type = "warning";
        if(!options.content){
            options.content = options.title
            options.title = "";
        }
        open_modal(options);
    };
});


/*********** METHOD FOR OPEN A MODAL WITH CONTENT OR FETCH FROM A URL ***********/
/*
 * open a bootstrap modal for ajax or inline contents
 * show_footer: boolean true/false, default false
 * title: title for the modal
 * content: content for the modal, this can be empty and use below attr
 * url: url for the ajax or iframe request and get the content for the modal
 * mode: inline/ajax/iframe
 * ajax_params: json with ajax params
 * modal_size: "modal-lg", "modal-sm", ""(default as normal "")
 * callback: function evaluated after modal shown
 * type: modal color (primary|default|success)
 * zindex: Integer zindex position (default null)
 * on_submit: Function executed after submit button click (if this is present, enable the submit button beside cancel button)
 * on_close: function executed after modal closed
 * return modal object
 */
function open_modal(settings){
    var def = {title: "", content: null, url: null, show_footer: false, mode: "inline", ajax_params: {}, id: 'ow_inline_modal', zindex: null, modal_size: "", type: '', modal_settings:{}, on_submit: null, callback: function(){}, on_close: function(){}}
    settings = $.extend({}, def, settings);
    if(settings.id){
        var hidden_modal = $("#"+settings.id);
        if(hidden_modal.size()){ hidden_modal.modal('show'); return hidden_modal; }
    }
    var modal = $('<div id="'+settings.id+'" class="modal fade modal-'+settings.type+'">'+
        '<div class="modal-dialog '+settings.modal_size+'">'+
        '<div class="modal-content">'+
        '<div class="modal-header">'+
        '<button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>'+
        '<h4 class="modal-title">'+settings.title+'</h4>'+
        '</div>'+
        '<div class="modal-body"></div>'+
        ((settings.show_footer || settings.on_submit)?'<div class="modal-footer"> '+(settings.on_submit ? '<button type="button" class="btn btn-primary modal_submit" ><i class="fa fa-save"></i> '+I18n("button.save")+'</button>' : '')+' <button type="button" class="btn btn-default" data-dismiss="modal"><i class="fa fa-arrow-circle-down"></i> '+I18n("button.close")+'</button></div>':'')+
        '</div>'+
        '</div>'+
        '</div>');

    // on modal hide
    modal.on("hidden.bs.modal", function(e){
        settings.on_close(modal);
        if(!$(e["currentTarget"]).attr("data-skip_destroy")) $(e["currentTarget"]).remove();
        modal_fix_multiple();
    });

    if(settings.zindex) modal.css("z-index", settings.zindex);

    // submit button
    if(settings.on_submit) modal.find(".modal-footer .modal_submit").click(function(){
        settings.on_submit(modal);
    });

    // on modal show
    modal.on("show.bs.modal", function(e){
        if(!modal.find(".modal-title").text()) modal.find(".modal-header .close").css("margin-top", "-9px");
        settings.callback(modal);
    });

    // show modal
    if(settings.mode == "inline"){
        modal.find(".modal-body").html(settings.content);
        modal.modal(settings.modal_settings);
    }else if(settings.mode == "iframe"){
        modal.find(".modal-body").html('<iframe id="ow_inline_modal_iframe" style="min-height: 500px;" src="'+settings.url+'" width="100%" frameborder=0></iframe>');
        modal.modal(settings.modal_settings);
    }else{ //ajax mode
        showLoading();
        $.get(settings.url, settings.ajax_params, function(res){
            modal.find(".modal-body").html(res);
            hideLoading()
            modal.modal(settings.modal_settings);
        });
    }
    return modal;
}

/**************LOADING SPINNER************/
function showLoading(){ $.fn.customLoading("show"); }
function hideLoading(){ $.fn.customLoading("hide"); }
jQuery(function(){
    /**
     * params:
     *  percentage: integer (percentage of the progress)
     *  state: String (show | hide)
     * Sample:
     *  $.fn.customLoading("show"); // show loading
     *  $.fn.customLoading("hide"); // hide de loading
     */
    $.fn.customLoading2 = function(params){
        if(!params) params = "show";
        if(typeof params == "string") params = {state: params};
        var settings = $.extend({}, {percentage: 100, state: "show"}, params);
        if(settings.state == "show"){
            if($("body > #custom_loading").length == 0)
                $("body").append('<div id="custom_loading" style="position: fixed; z-index: 99999; width: 100%; top: 0px; height: 15px;" class="progress"><div class="progress-bar progress-bar-striped active progress-bar-success" role="progressbar" aria-valuenow="45" aria-valuemin="0" aria-valuemax="100" style="width: '+settings.percentage+'%;"><span class="sr-only">45% Complete</span></div></div>');
            else
                $("body > #custom_loading").width(settings.percentage);
        }else{
            $("body > #custom_loading").remove();
        }
    }

    $.fn.customLoading = function(params){
        if(!params) params = "show";
        if(typeof params == "string") params = {state: params};
        var settings = $.extend({}, {percentage: 100, state: "show"}, params);
        if(settings.state == "show"){
            if($("body > #cama_custom_loading").length == 0)
                $("body").append('<div id="cama_custom_loading"><div class="back_spinner"></div><div class="loader_spinner"></div></div>');
            else
                $("body > #cama_custom_loading").width(settings.percentage);
        }else{
            $("body > #cama_custom_loading").remove();
        }
    }
});





