(function() {
  window['cama_init_posttype_form'] = function() {
    var form;
    form = $("#post_type_form");
    form.find('.unput_upload').input_upload();
    form.find("[name='meta[has_parent_structure]']").change(function() {
      var item;
      item = form.find("#meta_contents_route_format_hierarchy_post");
      item.parent().siblings().find("input").prop("disabled", $(this).is(":checked"));
      if ($(this).is(":checked")) {
        return item.prop("checked", true).prop("disabled", false);
      } else {
        return item.prop("disabled", true);
      }
    }).trigger("change");
    return form.find('[name="meta[has_picture]"]').change(function() {
      var items;
      items = form.find('.picture_settings input');
      if ($(this).is(":checked")) {
        return items.prop("disabled", false);
      } else {
        return items.prop("disabled", true);
      }
    }).trigger("change");
  };

}).call(this);
