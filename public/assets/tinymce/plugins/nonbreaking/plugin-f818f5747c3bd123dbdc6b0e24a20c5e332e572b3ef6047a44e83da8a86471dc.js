!function(){"use strict";var n=tinymce.util.Tools.resolve("tinymce.PluginManager"),e=function(n,e){var t,a=(t=n).plugins.visualchars&&t.plugins.visualchars.isEnabled()?'<span class="mce-nbsp">&nbsp;</span>':"&nbsp;";n.insertContent(function(n,e){for(var t="",a=0;a<e;a++)t+=n;return t}(a,e)),n.dom.setAttrib(n.dom.select("span.mce-nbsp"),"data-mce-bogus","1")},t=function(n){n.addCommand("mceNonBreaking",function(){e(n,1)})},a=tinymce.util.Tools.resolve("tinymce.util.VK"),i=function(n){var e=n.getParam("nonbreaking_force_tab",0);return"boolean"==typeof e?!0===e?3:0:e},o=function(n){var t=i(n);t>0&&n.on("keydown",function(i){if(i.keyCode===a.TAB&&!i.isDefaultPrevented()){if(i.shiftKey)return;i.preventDefault(),i.stopImmediatePropagation(),e(n,t)}})},r=function(n){n.addButton("nonbreaking",{title:"Nonbreaking space",cmd:"mceNonBreaking"}),n.addMenuItem("nonbreaking",{text:"Nonbreaking space",cmd:"mceNonBreaking",context:"insert"})};n.add("nonbreaking",function(n){t(n),r(n),o(n)})}();
