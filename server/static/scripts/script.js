$(document).ready(function() {
  /*This is just so I remember how to animate things
  $("#testDoc").animate({left: '+=100px',
                         top: '+=100px'})
  */

  //We only want the spinning wheel to show when needed
  $("#waitContainer").hide()

  //This initializes the popover so we can manually activate it later
  $("#predictButton").popover({
    content: "Please give us your predictions for more documents (30 total)" +
      " before trying to get our predictions",
    placement: 'top',
    trigger: 'manual'
  })

  //This makes use of the data from the /getdoc endpoint
  function useDocData(data) {
    Cookies.set('mdm_doc_number', data['doc_number'])
    $("#docText").text(data['document'])
    $("#waitContainer").hide()
  }

  //This makes use of the data from the /olddoc endpoint
  function useOldDocData(data) {
    Cookies.set('mdm_doc_number', data['doc_number'])
    $("#docText").text(data['document'])
    //Remake the dots that were there before the refresh
    for (var docNumber in data['labeled_docs']) {
      var cx = data['labeled_docs'][docNumber][0] * 100
      var cy = data['labeled_docs'][docNumber][1] * 100
      makeDot(cx, cy, docNumber)
    }
    for (var docNumber in data['predicted_docs']) {
      var cx = data['predicted_docs'][docNumber][0] * 100
      var cy = data['predicted_docs'][docNumber][1] * 100
      makeDot(cx, cy, docNumber)
    }
    $("#waitContainer").hide()
  }

	//Get a new uuid and needed document info
  if (Cookies.get('mdm_uuid') === undefined) {
    $.get('/uuid', function(data) {
      Cookies.set('mdm_uuid', data['id'])
      $.ajax({
        url: '/getdoc',
        headers: {'uuid': Cookies.get('mdm_uuid')},
        success: useDocData
      })
    })
  }
	//They already have a uuid, get needed document info
  else {
    $("#waitContainer").show()
    $.ajax({
      url: '/olddoc',
      headers: {'uuid': Cookies.get('mdm_uuid'),
                'doc_number': Cookies.get('mdm_doc_number')},
      success: useOldDocData
    })
  }

  //Creates an SVG element in a way JQuery can work with it
  function svg(tag) {
    return document.createElementNS('http://www.w3.org/2000/svg', tag)
  }

  //Creates a document circle (this may not be small enough)
  function makeDot(cx, cy, docNum) {
    $("#mapBase").append($(svg('circle')).attr('id', 'doc' + docNum)
                                         .attr('class', 'dot')
                                         .attr('cx', cx + '%')
                                         .attr('cy', cy + '%')
                                         .attr('r', '0.2%')
                                         .attr('stroke', 'gray')
                                         .attr('stroke-width', 1)
                                         .attr('fill', 'gray')
                                         .attr('stroke-opacity', '0.2')
                                         .attr('fill-opacity', '0.2'))
  }

  //Transforms data from a click to what's needed to make a dot
  function makeDotFromClick(posX, posY) {
    //Get where the circle should go as x and y positions
    //Multiply by 100 to get percentages
    var cx = (posX / $("#mapBase").width()) * 100
    var cy = (posY / $("#mapBase").height()) * 100
    makeDot(cx, cy, Cookies.get('mdm_doc_number'))
  }

  //This gets predictions for some number of documents from the server
  //  and puts them on the Metadata Map so a user can see them
  function subMakePredictions(numPredictions) {
    console.log('subMakePredictions called with ' + numPredictions + ' desired')
    $.ajax({
      url: '/predictions',
      headers: {'uuid': Cookies.get('mdm_uuid'),
                'num_docs': numPredictions},
      success: function usePredictions(data) {
        var docs = data['documents']
        for (var i = 0; i < docs.length; i++) {
          //Convert cx and cy from decimal to percentage
          var cx = docs[i]['predicted_label_x'] * 100
          var cy = docs[i]['predicted_label_y'] * 100
          var docNum = docs[i]['doc_number']
          //TODO: docText is not currently used, but will be later.
          var docText = docs[i]['document']
          makeDot(cx, cy, docNum)
          $("#waitContainer").hide()
        }
      }
    })
  }

  //This calls subMakePredictions because I can't find a good way to pass a
  //  value to it while setting it as the listener... Must be a better way
  function makePredictions(event) {
    event.preventDefault()
    $.ajax({
      url: '/istrained',
      headers: {'uuid': Cookies.get('mdm_uuid')},
      success: function(data) {
        if (data['trained'] === true) {
          $("#waitContainer").show()
          var numPredictions = parseInt($("#predictInput").val())
          subMakePredictions(numPredictions)
        }
        else {
          $("#predictButton").popover('show')
          setTimeout(function() {
            $("#predictButton").popover('hide')
          }, 3000)
        }
      }
    })
  }

  //Assign a listener to handle the user wanting to get the model's predictions
  $("#predictForm").on('submit', makePredictions)

  //Transforms a line position (between 0 and lineLength) to a label
  //  (between 0 and 1)
  function lineToLabel(line) {
    var lineLength = $("#mapBase").width()
    //We want to avoid exactly 0 and exactly 1
    //TODO: I'm not sure this is actually true, I don't think the model cares
    if (line === 0) { return 0.01 / lineLength }
    else if (line === lineLength) { return (lineLength - 0.01) / lineLength }
    else { return line / lineLength }
  }

  //This gets the offset of the map's left side from the screen edge
  function leftMapOffset() {
    return $("#mapBase").offset().left
  }

  //This gets the offset of the map's top side from the screen edge
  function topMapOffset() {
    return $("#mapBase").offset().top
  }

  //Assign an onclick handler to the map
  $("#mapBase").on('click', mapClickHandler)

  //This goes through all the ajax calls necessary to label a document
  function labelDoc(label_x, label_y) {
    $.ajax({
      url: '/labeldoc',
      method: 'POST',
      headers: {'uuid': Cookies.get('mdm_uuid')},
      data: {'doc_number': Cookies.get('mdm_doc_number'),
             'label_x': label_x,
             'label_y': label_y
            },
      success: function(labelData) {
        $.ajax({
          url: '/train',
          headers: {'uuid': Cookies.get('mdm_uuid')},
          success: function(trainData) {
            $.ajax({
              url: '/getdoc',
              headers: {'uuid': Cookies.get('mdm_uuid')},
              success: useDocData
            })
          }
        })
      }
    })
  }

  //This transforms a click on the map to a dot (on the map) and a label
  //  (in the model).
  function mapClickHandler(event) {
    //Subtract 1 to account for the border
    var xPos = parseInt(event.pageX) - leftMapOffset() - 1
    var yPos = parseInt(event.pageY) - topMapOffset() - 1
    console.log(xPos)
    console.log(yPos)
    if (xPos < 0 || xPos > $("#mapBase").width() ||
        yPos < 0 || yPos > $("#mapBase").height()) {
      //If on the border, we don't want the click to count
      return
    } 
    var label_x = lineToLabel(xPos)
    var label_y = lineToLabel(yPos)
    makeDotFromClick(xPos, yPos)
    //We show the spinning wheel here because we might train the model
    $("#waitContainer").show()
    labelDoc(label_x, label_y)
  }
})
