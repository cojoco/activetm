$(document).ready(function() {
  /*This is just so I remember how to animate things
  $("#testDoc").animate({left: '+=100px',
                         top: '+=100px'})
  */

  $("#waitContainer").hide()

  function useDocData(data) {
    Cookies.set('mdm_doc_number', data['doc_number'])
    $("#docText").text(data['document'])
    console.log("predicted_label_x is " + data['predicted_label_x'])
    console.log("uncertainty_x is " + data['uncertainty_x'])
    console.log("predicted_label_y is " + data['predicted_label_y'])
    console.log("uncertainty_y is " + data['uncertainty_y'])
    // Call this for old_doc endpoint case (it might train models, which
    //   takes a while and thus necessitates the spinning wheel)
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
      success: useDocData
    })
  }

  //Creates an SVG element in a way JQuery can work with it
  function svg(tag) {
    return document.createElementNS('http://www.w3.org/2000/svg', tag)
  }

  //Creates a document circle (this may not be small enough)
  function makeDot(cx, cy, docNum) {
    return $(svg('circle')).attr('id', 'doc' + docNum)
                           .attr('class', 'dot')
                           .attr('cx', cx + '%')
                           .attr('cy', cy + '%')
                           .attr('r', '0.2%')
                           .attr('stroke', 'gray')
                           .attr('stroke-width', 1)
                           .attr('fill', 'gray')
                           .attr('stroke-opacity', '0.2')
                           .attr('fill-opacity', '0.2')
  }

  //List of dot bins, 0.5 to 99.5 every 0.5 increment
  var dotBins = new Array(199)
  for (var i = 0; i <= 99.5; i += 0.5) {
		//Need a 2d list of dot bins
    dotBins[i] = new Array(199)
		for (var j = 0; j <= 99.5; j += 0.5) {
			dotBins[i][j] = []
		}
  }

  function labelToLine(label) {
    var lineLength = $("#lineContainer").width()
    //Our predictor sometimes predicts outside [0.005,0.995], so we push those values
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
      //TODO: Will this have any problems with float precision?
      if (label % 0.5 != 0) {
        label -= label % 0.5
      }
      return label
    }
  }

  //Transforms a line position (between 0 and lineLength) to a label
  //  (between 0 and 1)
  function lineToLabel(line) {
    var lineLength = $("#lineContainer").width()
    //We want to avoid exactly 0 and exactly 1
    //TODO: I'm not sure this is actually true, I don't think the model cares
    if (line === 0) { return 0.01 / lineLength }
    else if (line === lineLength) { return (lineLength - 0.01) / lineLength }
    else { return line / lineLength }
  }

})
