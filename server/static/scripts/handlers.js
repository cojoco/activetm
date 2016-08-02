//This holds all of the handlers used as callback functions

//This makes use of the data from the /getdoc endpoint
function useDocData(data) {
  Cookies.set('mdm_doc_number', data['doc_number'])
  $("#docText").text(data['document'])
  map.addDocument(new Document(data['doc_number'], data['document'],
                               undefined, undefined))
  $("#waitContainer").hide()
}

//This makes use of the data from the /olddoc endpoint
function useOldDocData(data) {
  Cookies.set('mdm_doc_number', data['doc_number'])
  $("#docText").text(data['document'])
  map.addDocument(new Document(data['doc_number'], data['document'],
                            undefined, undefined))
  //Remake the dots that were there before the refresh
  for (var docNumber in data['labeled_docs']) {
    var doc = data['labeled_docs'][docNumber]
    map.addDocument(new Document(docNumber, doc['text'], doc['x'], doc['y']))
    map.addDot(map.documents[docNumber].toDot())
  }
  for (var docNumber in data['predicted_docs']) {
    var doc = data['predicted_docs'][docNumber]
    map.addDocument(new Document(docNumber, doc['text'], doc['x'], doc['y']))
    map.addDot(map.documents[docNumber].toDot())
  }
  $("#waitContainer").hide()
}

//Handles the list mode button being clicked
function listButtonClicked(e) {
  $("#mapBase").off('click').on('click', checkForDots)
  console.log('In list mode')
}

//Handles the label mode button being clicked
function labelButtonClicked(e) {
  $("#mapBase").off('click').on('click', mapClickHandler)
  console.log('In label mode')
}

//Checks for dots under the mouse, called on mouseclick of the map in list mode
function checkForDots(event) {
  //Remove old documents so we only display those that were clicked on
  $(".listedDoc").remove()
  var list = []
  var nextEl = document.elementFromPoint(event.pageX, event.pageY)
  if (nextEl.id.slice(0,3) === 'dot') {
    list.push(nextEl)
    addLowerDocsToList(nextEl, event.pageX, event.pageY, list)
  }
}

//Recursively checks for dots under the mouse
function addLowerDocsToList(el, x, y, list) {
  var docText = map.documents[el.id.slice(3)].text
  var end = Math.min(docText.length, 97)
  var listItem = "<p id='" + el.id + "listed' class='listedDoc'>" +
                 docText.slice(0, end) + "..." + "</p>"
  $("#docList").append(listItem)
  $("#"+el.id).css('pointer-events', 'none')
  var nextEl = document.elementFromPoint(x, y)
  if (nextEl.id.slice(0,3) === 'dot') {
    list.push(nextEl)
    addLowerDocsToList(nextEl, x, y, list)
  }
  else {
    //Make it so the documents can be selected again in the future
    for (elem of list) {
      $("#"+elem.id).css('pointer-events', '')
    }
  }
}

//This goes through all the ajax calls necessary to label a document and get
//  a new one to label, training the model if necessary
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
  if (xPos < 0 || xPos > $("#mapBase").width() ||
      yPos < 0 || yPos > $("#mapBase").height()) {
    //If on the border, we don't want the click to count
    return
  } 
  var label = clickToLabel(xPos, yPos)
  var docNumber = Cookies.get('mdm_doc_number')
  map.documents[docNumber].labelX = label['x']
  map.documents[docNumber].labelY = label['y']
  map.addDot(map.documents[docNumber].toDot())
  //We show the spinning wheel here because we might train the model
  $("#waitContainer").show()
  labelDoc(label['x'], label['y'])
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
        var labelX = docs[i]['predicted_label_x']
        var labelY = docs[i]['predicted_label_y']
        var docNum = docs[i]['doc_number']
        var docText = docs[i]['document']
        map.addDocument(new Document(docNum, docText, labelX, labelY))
        map.addDot(map.documents[docNum].toDot())
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

//Starts a new session, assuming we have no uuid
function startNewSession() {
  $.get('/uuid', function(data) {
    Cookies.set('mdm_uuid', data['id'])
    $.ajax({
      url: '/getdoc',
      headers: {'uuid': Cookies.get('mdm_uuid')},
      success: useDocData
    })
  })
}

//Resumes an old session, which assumes we have a uuid
function resumeOldSession() {
  $("#waitContainer").show()
  $.ajax({
    url: '/olddoc',
    headers: {'uuid': Cookies.get('mdm_uuid'),
              'doc_number': Cookies.get('mdm_doc_number')},
    success: useOldDocData
  })
}
