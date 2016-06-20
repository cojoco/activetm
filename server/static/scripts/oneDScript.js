$(document).ready(function() {
  /*This is just so I remember how to animate things
  $("#testDoc").animate({left: '+=100px',
                         top: '+=100px'})
  */

  // Get info on the line's position to use to place the documents
  var minX = Number($("#lineBase").attr("x1"))
  var maxX = Number($("#lineBase").attr("x2"))
  var minY = Number($("#lineBase").attr("y1"))-30
  var maxY = minY + 36

  if (Cookies.get('uuid') === undefined) {
    $.get('/uuid', function(data) {
      Cookies.set('uuid', data['id'])
    })
  }

  $("#docButton").click(function(ev) {
    $.ajax({
      url: '/getdoc',
      headers: {'uuid': Cookies.get('uuid')},
      success: function(data) {
        Cookies.set('doc_number', data['doc_number'])
        console.log(data)
      }
    })
  })

  $("#testDoc").draggable({
    containment: 'parent',
    cursor: 'move',
    stop: docDragHandler
  })

  function docDragHandler( event, ui ) {
    var offsetXPos = parseInt(ui.offset.left) - $(".container").offset().left
    var offsetYPos = parseInt(ui.offset.top)
    if (offsetXPos >= minX && offsetXPos < maxX &&
        offsetYPos >= minY && offsetYPos < maxY) {
      //Normalize the label to a value between 0 and 1 to send back
      console.log("offsetXPos: " + offsetXPos)
      console.log("minX: " + minX + " maxX: " + maxX)
      var lineLeft = Number($("#lineBase").attr("x1"))
      var lineRight = Number($("#lineBase").attr("x2"))
      var label = (offsetXPos - lineLeft)/(lineRight - lineLeft)
      $.ajax({
        url: '/labeldoc',
        method: 'POST',
        headers: {'uuid': Cookies.get('uuid')},
        data: {'doc_number': Cookies.get('doc_number'),
               'label': label
              },
        success: function(data) {
          console.log("labeled a document")
        }
      })
    } 
  }
})
