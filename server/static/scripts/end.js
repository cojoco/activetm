$(document).ready(function() {
  if (!document.hidden) {
    $.ajax({
        url: '/removeuser',
        headers: {'uuid': Cookies.get('mdm_uuid')}
    })
    Cookies.remove('mdm_uuid')
    Cookies.remove('mdm_doc_number')
  }
})
