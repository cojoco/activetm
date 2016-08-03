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
    var modal = $('<div>').attr('id', modalId)
                          .attr('class', 'modal fade')
                          .attr('role', 'dialog')
    var modalOuter = $('<div>').attr('class', 'modal-dialog')
    var modalInner = $('<div>').attr('class', 'modal-content')
    var modalTabs = $('<div>').attr('class', 'tab-content')
    var tab1Id = 'modal' + this.id + 'Tab1'
    var modalTab1 = $('<div>').attr('id', tab1Id)
                      .attr('class', 'tab-pane fade in active')
                      .html('<p>This is the first tab</p>')
    var tab2Id = 'modal' + this.id + 'Tab2'
    var modalTab2 = $('<div>').attr('id', tab2Id)
                      .attr('class', 'tab-pane fade')
                      .html('<p>This is the second tab</p>')
    var tab3Id = 'modal' + this.id + 'Tab3'
    var modalTab3 = $('<div>').attr('id', tab3Id)
                      .attr('class', 'tab-pane fade')
                      .html('<p>This is the third tab</p>')
    var modalGUITabs = $('<ul>').attr('class', 'nav nav-tabs')
                      .append('<li class="active"><a data-toggle="tab" href="#' + tab1Id + '">Main</a></li>')
                      .append('<li><a data-toggle="tab" href="#' + tab2Id + '">Text</a></li>')
                      .append('<li><a data-toggle="tab" href="#' + tab3Id + '">Topics</a></li>')
    var modalHeader = $('<div>').attr('class', 'modal-header')
                        .html('<h4 class="modal-title">Title: ' + this.title +
                              '</h4>')
    var modalBody = $('<div>').attr('class', 'modal-body')
                      .append(modalGUITabs)
    //Put together the modal and its tab panes
    modalTabs.append(modalTab1).append(modalTab2).append(modalTab3)
    modalBody.append(modalTabs)
    modalInner.append(modalHeader).append(modalBody)
    modalOuter.append(modalInner)
    modal.append(modalOuter)
    //Stick the modal and tabs in the DOM
    $("#modals").append(modal)
    //Return a newly created paragraph
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
