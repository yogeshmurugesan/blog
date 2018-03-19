(function() {
  $(function() {
    var f;
    f = $("#login_user");
    return f.submit(function() {
      var e;
      if (typeof f.valid === "function" ? f.valid() : void 0) {
        e = f.find("input[name='user[password]']");
        return e.val(GibberishAES.enc(e.val(), kk));
      }
    }).validate();
  });

}).call(this);
