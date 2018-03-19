(function() {
  $(function() {
    var last_data, list_panel, menu_form, menu_items_available, panel, save_menu;
    panel = $('#menu_content');
    menu_form = $('#menu_form');
    list_panel = $('#menus_list');
    menu_items_available = $('#menu_items');
    list_panel.nestable();
    last_data = {
      items: list_panel.nestable("serialize")
    };
    list_panel.on('change', function() {
      var data;
      data = {
        items: list_panel.nestable("serialize")
      };
      if (JSON.stringify(last_data) === JSON.stringify(data)) {
        return;
      }
      panel.find('#menu_reoreder_loading').show();
      return $.post(list_panel.attr('data-reorder_url'), data, function(res) {
        last_data = data;
        panel.find('#menu_reoreder_loading').hide();
        if (res) {
          return alert(res);
        }
      });
    });
    save_menu = function(data) {
      showLoading();
      return $.post(list_panel.attr('data-url'), data, function(res) {
        list_panel.children('.dd-list').append($(res).children());
        return hideLoading();
      });
    };
    menu_items_available.find(".add_links_to_menu").click(function() {
      var data, flag;
      data = {
        items: [],
        authenticity_token: menu_form.find('[name="authenticity_token"]').val()
      };
      flag = false;
      $(this).closest('.panel').find('input:checkbox:checked').each(function() {
        flag = true;
        return data['items'].push({
          id: $(this).val(),
          kind: $(this).closest('.class_type').attr('data-type')
        });
      }).prop('checked', false);
      if (!flag) {
        return false;
      }
      save_menu(data);
      return false;
    });
    menu_items_available.find(".add_links_custom_to_menu").click(function() {
      var data, flag;
      data = {
        custom_items: [],
        authenticity_token: menu_form.find('[name="authenticity_token"]').val()
      };
      flag = false;
      $(this).closest('.panel').find('input:checkbox:checked').each(function() {
        flag = true;
        return data['custom_items'].push({
          url: $(this).val(),
          kind: $(this).attr('data-kind'),
          label: $(this).attr('data-label')
        });
      }).prop('checked', false);
      if (!flag) {
        return false;
      }
      save_menu(data);
      return false;
    });
    menu_items_available.find('.form-custom-link').submit(function() {
      var form;
      form = $(this);
      if (!form.valid()) {
        return false;
      }
      save_menu({
        external: form.serializeObject()
      });
      this.reset();
      setTimeout(function() {
        return form.find('label.error').hide();
      }, 100);
      return false;
    });
    list_panel.on('click', '.item_external', function() {
      var link;
      link = $(this);
      open_modal({
        title: link.attr('data-original-title') || link.attr('title'),
        url: link.attr('href'),
        mode: 'ajax',
        callback: function(modal) {
          var form;
          form = modal.find('form');
          init_form_validations(form);
          return form.submit(function() {
            if (!form.valid()) {
              return false;
            }
            showLoading();
            $.post(form.attr('action'), form.serialize(), function(res) {
              link.closest('li').replaceWith($(res).html());
              modal.modal("hide");
              return hideLoading();
            });
            return false;
          });
        }
      });
      return false;
    });
    list_panel.on('click', '.delete_menu_item', function() {
      var link;
      link = $(this);
      if (!confirm(I18n('msg.confirm_del', 'Are you sure to delete this item?'))) {
        return false;
      }
      showLoading();
      $.get(link.attr('href'), function() {
        link.closest('.dd-item').remove();
        return hideLoading();
      });
      return false;
    });
    panel.find('.new_menu_link, .edit_menu_link').ajax_modal({
      callback: function(modal) {
        var form;
        form = modal.find('form');
        return setTimeout(function() {
          return init_form_validations(form);
        }, 1000);
      }
    });
    panel.find('#menu_items #switch_nav_menu_form select').change(function() {
      if (!$(this).val()) {
        return;
      }
      return $(this).closest('form').submit();
    });
    return list_panel.on('click', '.custom_settings_link', function() {
      var link;
      link = $(this);
      open_modal({
        title: link.attr('data-original-title') || link.attr('title'),
        url: link.attr('href'),
        mode: 'ajax',
        callback: function(modal) {
          var form;
          form = modal.find('form');
          init_form_validations(form);
          return form.submit(function() {
            if (!form.valid()) {
              return false;
            }
            showLoading();
            $.post(form.attr('action'), form.serialize(), function(res) {
              if (res) {
                alert(res);
              }
              modal.modal("hide");
              return hideLoading();
            });
            return false;
          });
        }
      });
      return false;
    });
  });

}).call(this);
