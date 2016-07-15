$(document).ready(function() {
  /*This is just so I remember how to animate things
  $("#testDoc").animate({left: '+=100px',
                         top: '+=100px'})
  */

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

  //Creates an SVG element in a way JQuery can work with it
  function svg(tag) {
    return document.createElementNS('http://www.w3.org/2000/svg', tag)
  }

  //Creates a document circle (this may not be small enough)
  function makeDot(cx, cy, docNum) {
    return $(svg('circle')).attr('id', 'doc' + docNum)
                           .attr('class', 'docDot')
                           .attr('cx', cx + '%')
                           .attr('cy', cy)
                           .attr('r', 2)
                           .attr('stroke', 'black')
                           .attr('stroke-width', 1)
                           .attr('fill', 'black')
  }

  //List of dot bins, 0.5 to 99.5 every 0.5 increment
  var dotBins = new Array(199)
  for (var i = 0; i <= 99.5; i += 0.5) {
    dotBins[i] = []
  }

  //Creating dots
  // dotPlace: float, this is the % on the line (range [0.5,99.5])
  // docNum: int, document number so we can map dots to documents
  var makeNewDot = function makeNewDot(dotPlace, docNum) {
    var cy = 98 - (4 * dotBins[dotPlace].length)
    dotBins[dotPlace].push(docNum)
    var newDot = makeDot(dotPlace, cy, docNum)
    $("#mapBase").append(newDot)
  }

  //For testing creating new dots
  $("#newDotButton").on('click', makeNewDot)

  //Transforms a label (between 0 and 1) to a line position (between 0 and 1000)
  function labelToLine(label) {
    var lineLength = $("#lineContainer").width()
    //Our predictor sometimes predicts outside [0,1), so we push those values
    //  inside the valid range
    if (label > 0.995) {
      label = 0.995
    }
    if (label < 0.005) {
      label = 0.005
    }
    return label * lineLength
  }

  //Transforms a label to a dot position
  function labelToDot(label) {
    //We want the dot position to be [0.5,99.5] and divide cleanly by 0.5
    if (label > 0.995) {
      label = 99.5
      return label
    }
    else if (label < 0.005) {
      label = 0.5
      return label
    }
    else {
      label *= 100
      //Get the label to be cleanly divisible by 0.5
      if (label % 0.5 != 0) {
        label -= label % 0.5
      }
      return label
    }
  }

  //Transforms a line position (between 0 and 1000) to a label (between 0 and 1)
  function lineToLabel(line) {
    var lineLength = $("#lineContainer").width()
    //We want to avoid exactly 0 and exactly 1
    if (line === 0) { return 0.01 / lineLength }
    else if (line === lineLength) { return (lineLength - 0.01) / lineLength }
    else { return line / lineLength }
  }

  //Gets the current left offset of the container
  function leftOffset() {
    return $("#lineContainer").offset().left
  }

  //Gets the current top offset of the container
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
      var dotPosition = labelToDot(label)
      makeNewDot(dotPosition, Cookies.get('mdm_doc_number'))
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
