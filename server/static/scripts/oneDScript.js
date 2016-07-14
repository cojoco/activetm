$(document).ready(function() {
  /*This is just so I remember how to animate things
  $("#testDoc").animate({left: '+=100px',
                         top: '+=100px'})
  */

  // Get info on the line's position to use to place the documents.
  // Add 0.1 to minX to avoid division by zero errors.

  $("#waitContainer").hide()

  if (Cookies.get('mdm_uuid') === undefined) {
    $.get('/uuid', function(data) {
      Cookies.set('mdm_uuid', data['id'])
      $.ajax({
        url: '/getdoc',
        headers: {'uuid': Cookies.get('mdm_uuid')},
        success: function(data) {
          Cookies.set('mdm_doc_number', data['doc_number'])
          $("#docText").text(data['document'])
          console.log("predicted_label is " + data['predicted_label'])
          console.log("uncertainty is " + data['uncertainty'])
        }
      })
    })
  }
  else {
    $("#waitContainer").show()
    $.ajax({
      url: '/olddoc',
      headers: {'uuid': Cookies.get('mdm_uuid'),
                'doc_number': Cookies.get('mdm_doc_number')},
      success: function(data) {
        $("#docText").text(data['document'])
        console.log("predicted_label is " + data['predicted_label'])
        console.log("uncertainty is " + data['uncertainty'])
        $("#waitContainer").hide()
      }
    })
  }

  //Transforms a label (between 0 and 1) to a line position (between 0 and 1000)
  function labelToLine(label) {
    var lineLength = $("#lineContainer").width()
    return label * lineLength
  }

  //Transforms a line position (between 0 and 1000) to a label (between 0 and 1)
  function lineToLabel(line) {
    var lineLength = $("#lineContainer").width()
    //We want to avoid exactly 0 and exactly 1
    if (line === 0) { return (line + 0.01) / lineLength }
    else if (line === lineLength) { return (line - 0.01) / lineLength }
    else { return line / lineLength }
  }

  //Gets the left offset of the container
  function leftOffset() {
    return $("#lineContainer").offset().left
  }

  //Gets the top offset of the container
  function topOffset() {
    return $("#lineContainer").offset().top + 60
  }

  //Assign a handler to the click event
  $("#mapBase").click(lineClickHandler)

  // Handles a document being labeled by a click on the line
  function lineClickHandler(event) {
    var offsetXPos = parseInt(event.pageX)
    var offsetYPos = parseInt(event.pageY)
    if (offsetXPos >= leftOffset() && offsetXPos < $("#lineContainer").width() +
                                                 leftOffset() &&
        offsetYPos >= topOffset() && offsetYPos < $("#lineContainer").height() +
                                           topOffset()) {
      //Normalize the label to a value between 0 and 1 to send back
      var label = lineToLabel(offsetXPos - leftOffset())
      //Show spinning circle until training is done (or until the server
      //  tells us we aren't training yet)
      $("#waitContainer").show()
      $.ajax({
        url: '/labeldoc',
        method: 'POST',
        headers: {'uuid': Cookies.get('mdm_uuid')},
        data: {'doc_number': Cookies.get('mdm_doc_number'),
               'label': label
              },
        success: function(data) {
          // Should only get a new document if we're supposed to keep going,
          //   that's not in here yet though.
          $.ajax({
            url: '/getdoc',
            headers: {'uuid': Cookies.get('mdm_uuid')},
            success: function(docData) {
              Cookies.set('mdm_doc_number', docData['doc_number'])
              $("#docText").text(docData['document'])
              console.log("Predicted label is " + docData['predicted_label'])
              console.log("uncertainty is " + docData['uncertainty'])
            }
          })
          $.ajax({
            url: '/train',
            headers: {'uuid': Cookies.get('mdm_uuid')},
            success: function(trainData) {
              //End spinning circle here, since we're done training
              $("#waitContainer").hide()
              console.log("Training returned")
            }
          })
        }
      })
    }
  }
})
