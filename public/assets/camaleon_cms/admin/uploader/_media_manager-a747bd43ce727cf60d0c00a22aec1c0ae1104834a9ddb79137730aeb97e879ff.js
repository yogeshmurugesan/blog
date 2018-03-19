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
