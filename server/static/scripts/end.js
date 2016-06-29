$(document).ready(function() {
  if (!document.hidden) {
    $.ajax({
        url: '/removeuser',
        headers: {'uuid': Cookies.get('uuid')}
    })
    Cookies.remove('uuid')
  }
})
