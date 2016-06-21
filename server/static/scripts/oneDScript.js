$(document).ready(function() {
  /*This is just so I remember how to animate things
  $("#testDoc").animate({left: '+=100px',
                         top: '+=100px'})
  */

  // Get info on the line's position to use to place the documents
  var minX = Number($("#lineBase").attr("x1"))
  var maxX = Number($("#lineBase").attr("x2"))
  var minY = Number($("#lineBase").attr("y1"))-15
  var maxY = minY + 30

  if (Cookies.get('uuid') === undefined) {
    $.get('/uuid', function(data) {
      Cookies.set('uuid', data['id'])
    })
  }

  //Transforms a label (between 0 and 1) to a line position (between 0 and 1000)
  function labelToLine(label) {
    var lineLength = maxX - minX
    return label * lineLength
  }

  //Transforms a line position (between 0 and 1000) to a label (between 0 and 1)
  function lineToLabel(line) {
    var lineLength = maxX - minX
    return line / lineLength
  }

  $("#mapBase").click(lineClickHandler)

  // Handles a document being labeled by a click on the line
  function lineClickHandler(event) {
    var offsetXPos = parseInt(event.pageX) - $(".container").offset().left + 0.5
    var offsetYPos = parseInt(event.pageY)
    console.log(offsetXPos + " " + minX)
    if (offsetXPos >= minX && offsetXPos < maxX &&
        offsetYPos >= minY && offsetYPos < maxY) {
      //Normalize the label to a value between 0 and 1 to send back
      var label = lineToLabel(offsetXPos)
      $.ajax({
        url: '/labeldoc',
        method: 'POST',
        headers: {'uuid': Cookies.get('uuid')},
        data: {'doc_number': Cookies.get('doc_number'),
               'label': label
              },
        success: function(data) {
          // Should only get a new document if we're supposed to keep going,
          //   that's not in here yet though.
          $.ajax({
            url: '/getdoc',
            headers: {'uuid': Cookies.get('uuid')},
            success: function(data) {
              Cookies.set('doc_number', data['doc_number'])
              $("#docText").text(data['document'])
            }
          })
        }
      })
    } 
  }
})
