//This class holds the doc number, text and labels

function Document(number, text, title, labelX, labelY) {
  this.number = number //Document number, as given by the server
  this.id = 'doc' + number //ID of this document in the DOM
  this.text = text //Text of the document
  this.title = title //Title of the document, not always the most informative
  this.labelX = labelX //Label of the document for the horizontal axis
  this.labelY = labelY //Label of the document for the vertical axis
}

Document.prototype = {
  constructor: Document,

  //Creates a <p> element to stick in the DOM
  toParagraph: function toParagraph() {
    //This measures how far into the document's text we can slice
    var end = Math.min(this.text.length, 97)
    //Return a newly created paragraph
    return $('<p>').attr('id', this.id + 'listed')
                   .attr('class', 'listedDoc')
                   .text(this.text.slice(0, end) + '...')
  },

  //Creates a list entry <div> to stick in the DOM
  toListEntry: function toListEntry() {
    //This measures how far into the document's text we can slice
    var end = Math.min(this.text.length, 97)
    var titleString = 'title: ' + this.title
    var textString = 'text: ' + this.text.slice(0, end) + '...'
    var modalId = 'modal' + this.id
    //Create the button that lets you get to the document's modal
    var modalButton = $('<button>').attr('id', this.id + 'listedButton')
                                   .attr('class', 'listedButton btn btn-sm')
                                   .attr('data-toggle', 'modal')
                                   .attr('data-target', '#' + modalId)
                                   .text('Select Document')
    //Create the modal itself
    var tab1Id = 'modal' + this.id + 'Tab1'
    var tab2Id = 'modal' + this.id + 'Tab2'
    var tab3Id = 'modal' + this.id + 'Tab3'
    var temp = $('<div>')
    //Basically what I do is create a very long template, append it to temp
    //  to get it parsed, then pull it out of temp and put it in the modals div
    //I'm not sure whether this is better or worse than building it using
    //  JQuery and .attr() below.
    var tmpMod = '<div id="' + modalId + '" class="modal fade" ' +
                   'role="dialog">' + 
                   '<div class="modal-dialog">' + 
                     '<div class="modal-content">' +
                       '<div class="modal-header">' +
                         '<h4 class="modal-header">' +
                           'Title: ' + this.title +
                         '</h4>' +
                       '</div>' +
                       '<div class="modal-body">' +
                         '<ul class="nav nav-tabs">' + 
                           '<li class="active">' +
                             '<a data-toggle="tab" href="#' + tab1Id + '">' +
                               'Main' +
                             '</a>' +
                           '</li>' +
                           '<li>' +
                             '<a data-toggle="tab" href="#' + tab2Id + '">' +
                               'Text' +
                             '</a>' +
                           '</li>' +
                           '<li>' +
                             '<a data-toggle="tab" href="#' + tab3Id + '">' +
                               'Topics' +
                             '</a>' +
                           '</li>' +
                         '</ul>' +
                         '<div class="tab-content">' +
                           '<div id="' + tab1Id + '" class="tab-pane fade ' +
                             'active in">' +
                             '<p>This is the first tab ' + tab1Id + '</p>' +
                           '</div>' +
                           '<div id="' + tab2Id + '" class="tab-pane fade">' +
                             '<p>' + this.text + '</p>' +
                           '</div>' +
                           '<div id="' + tab3Id + '" class="tab-pane fade">' +
                           '</div>' +
                         '</div>' +
                       '</div>' +
                     '</div>' +
                   '</div>' +
                 '</div>'
    temp.html(tmpMod)
    var modal = temp.first()
//    var modal = $('<div>').attr('id', modalId)
//                          .attr('class', 'modal fade')
//                          .attr('role', 'dialog')
//    var modalOuter = $('<div>').attr('class', 'modal-dialog')
//    var modalInner = $('<div>').attr('class', 'modal-content')
//    var modalTabs = $('<div>').attr('class', 'tab-content')
//    var modalTab1 = $('<div>').attr('id', tab1Id)
//                      .attr('class', 'tab-pane fade in active')
//                      .html('<p>This is the first tab</p>')
//    var modalTab2 = $('<div>').attr('id', tab2Id)
//                      .attr('class', 'tab-pane fade')
//                      .html('<p>This is the second tab</p>')
//    var modalTab3 = $('<div>').attr('id', tab3Id)
//                      .attr('class', 'tab-pane fade')
//                      .html('<p>This is the third tab</p>')
//    var modalGUITabs = $('<ul>').attr('class', 'nav nav-tabs')
//                      .append('<li class="active"><a data-toggle="tab" href="#' + tab1Id + '">Main</a></li>')
//                      .append('<li><a data-toggle="tab" href="#' + tab2Id + '">Text</a></li>')
//                      .append('<li><a data-toggle="tab" href="#' + tab3Id + '">Topics</a></li>')
//    var modalHeader = $('<div>').attr('class', 'modal-header')
//                        .html('<h4 class="modal-title">Title: ' + this.title +
//                              '</h4>')
//    var modalBody = $('<div>').attr('class', 'modal-body')
//                      .append(modalGUITabs)
//    //Put together the modal and its tab panes
//    modalTabs.append(modalTab1).append(modalTab2).append(modalTab3)
//    modalBody.append(modalTabs)
//    modalInner.append(modalHeader).append(modalBody)
//    modalOuter.append(modalInner)
//    modal.append(modalOuter)
    //Stick the modal and tabs in the DOM
    $("#modals").append(modal)
    var data = [{name: 'Topic 1', value: 0.4},
                {name: 'Topic 2', value: 0.2},
                {name: 'Topic 3', value: 0.3},
                {name: 'Topic 4', value: 0.1}]
    makePieChart(tab3Id, data)
    //Return a newly created list entry
    return $('<div>').attr('id', this.id + 'listed')
                   .attr('class', 'listedDoc')
                   .html(titleString + '<br>' + textString + '<br>')
                   .append(modalButton)
  },

  //Creates a Dot object from this document
  toDot: function toDot() {
    return new Dot(this.number, this.labelX * 100, this.labelY * 100)
  }
}
