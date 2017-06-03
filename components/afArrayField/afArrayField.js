/* global AutoForm, arrayTracker */

Template.afArrayField.helpers({
  getTemplateName: function () {
    return AutoForm.getTemplateName('afArrayField', this.template, this.name);
  },
  innerContext: function afArrayFieldContext() {
    var c = AutoForm.Utility.getComponentContext(this, "afArrayField");

    this.enableSorting = !! c.atts.enableSorting;

    var name = c.atts.name;
    var fieldMinCount = c.atts.minCount || 0;
    var fieldMaxCount = c.atts.maxCount || Infinity;
    var ss = AutoForm.getFormSchema();
    var formId = AutoForm.getFormId();

    // Init the array tracking for this field
    var docCount = AutoForm.getArrayCountFromDocForField(formId, name);
    if (docCount === undefined) {
      docCount = c.atts.initialCount;
    }
    arrayTracker.initField(formId, name, ss, docCount, fieldMinCount, fieldMaxCount);

    return {
      atts: c.atts
    };
  }
});

let currKey;
let fromIdx;
let toIdx;
let arrayItemSiblings;

Template.afArrayField.rendered = function() {
  var self = this;


  function onSortUpdate(ui) {
    var arrayItems = self.findAll(".autoform-array-item");
    _.each(arrayItems, function(arrayItem, i) {
      function fixPosition(el) {
        var dataSchemaKey = $(el).attr("data-schema-key");

        if (! dataSchemaKey) return;

        console.log(dataSchemaKey);

        // if nested, then which of the indices was updated?
        // determine which one, and then update that one

        var schemaFields = dataSchemaKey.split('.');

        var mainField = schemaFields[0];
        var subField = schemaFields[2];

        dataSchemaKey = mainField + '.' + i + '.' + subField;

        $(el).attr("data-schema-key", dataSchemaKey);
        $(el).attr("name", dataSchemaKey);
      }

      _.each($(arrayItem).find("input"), fixPosition);
      _.each($(arrayItem).find("select"), fixPosition);
    });
  }


  if (!! this.data.enableSorting) {
    var listGroup = $(this.find(".list-group"));

    if (! listGroup.sortable) {
      throw new Error("Sortable arrays require jQuery UI");
    }

    listGroup.sortable({
      handle: ".autoform-drag-item",
      cancel: ".autoform-add-item-wrap",
      update: function(event, ui){
        // console.log('inside update, triggered when user stopped sorting and DOM position has changed');
        // console.log(ui.item.find("input").attr("data-schema-key"));
        // // console.log(ui.item.find("select").attr("data-schema-key"));
        //
        // // use this as the anchor point for contextualizing the data-schema-key when updating.
        //
        // var arrayItems = self.findAll(".autoform-array-item");
        // console.log("currKey: " + currKey);
        // _.each(arrayItems, function(arrayItem, i) {
        //   function fixPosition(el) {
        //     var dataSchemaKey = $(el).attr("data-schema-key");
        //
        //     if (! dataSchemaKey) return;
        //
        //     var schemaFields = dataSchemaKey.split('.');
        //
        //     var mainField = schemaFields[0];
        //     var subField = schemaFields[2];
        //
        //     dataSchemaKey = mainField + '.' + i + '.' + subField;
        //
        //     $(el).attr("data-schema-key", dataSchemaKey);
        //     $(el).attr("name", dataSchemaKey);
        //   }
        //
        //   _.each($(arrayItem).find("input"), fixPosition);
        //   _.each($(arrayItem).find("select"), fixPosition);
        // });

        /**
         * Fix the position on the schema key
         * @param schemaKey
         * @param newIdx
         * @returns {String} - updated schema key
         */
        const updateSchemaKey = (schemaKey, newIdx) => {
          let updatedSchemaKey,
            schemaIdxToFix,
            schemaFields = schemaKey.split('.');

          if ($.isNumeric(schemaFields[schemaFields.length-1])){
            schemaIdxToFix = schemaFields.length-1;
          } else if ($.isNumeric(schemaFields[schemaFields.length-2])){
            schemaIdxToFix = schemaFields.length-2;
          }
          schemaFields[schemaIdxToFix] = newIdx.toString();
          updatedSchemaKey = schemaFields.join('.');
          return updatedSchemaKey;
        };

        const updateChildrenSchemaKey = (preUpdateKey, postUpdateKey, children) => {
          // Snip last element in preUpdateKey, because it includes the name of current parentNode
          let preUpdateKeyFields = preUpdateKey.split("."),
            postUpdateKeyFields = postUpdateKey.split(".");
          preUpdateKeyFields.pop();
          postUpdateKeyFields.pop();
          preUpdateKey = preUpdateKeyFields.join(".");
          postUpdateKey = postUpdateKeyFields.join(".");
          _.each(children, (child) => {
            let childSchemaKey = $(child).find("input").attr("data-schema-key");
            console.log("Before: ", childSchemaKey);
            childSchemaKey = childSchemaKey.replace(preUpdateKey, postUpdateKey);
            $(child).find("input:first").attr("data-schema-key", childSchemaKey);
            $(child).find("input:first").attr("name", childSchemaKey);
            $(child).find("select:first").attr("data-schema-key", childSchemaKey);
            $(child).find("select:first").attr("name", childSchemaKey);
            console.log("After: ", childSchemaKey);
            // unlikely to have medium editor
            // if (!!$(child).find(".medium-editor").attr("data-schema-key")){
            //   let currMediumEditorKey = $(child).find(".medium-editor").attr("data-schema-key");
            // }
          });
        };

        // BEGIN NEW CODE
        // Updates the index for the item that was dragged and plopped
        toIdx = ui.item.index();
        let inputSchemaKey = updateSchemaKey(currKey, toIdx);
        $(ui.item.context).find("input:first").attr("data-schema-key", inputSchemaKey);
        $(ui.item.context).find("input:first").attr("name", inputSchemaKey);
        $(ui.item.context).find("select:first").attr("data-schema-key", inputSchemaKey);
        $(ui.item.context).find("select:first").attr("name", inputSchemaKey);

        if (!!$(ui.item.context).find(".medium-editor").attr("data-schema-key")){
          let currMediumEditorKey = $(ui.item.context).find(".medium-editor").attr("data-schema-key");
          let updatedMediumEditorKey = updateSchemaKey(currMediumEditorKey, toIdx);
          $(ui.item.context).find(".medium-editor:first").attr("data-schema-key", updatedMediumEditorKey);
          $(ui.item.context).find(".medium-editor:first").attr("name", updatedMediumEditorKey);
        }

        console.log("********");
        console.log($(ui.item.context).find("input").attr("data-schema-key"));
        console.log("preupdate key",currKey);
        console.log("postupdatekey", inputSchemaKey);
        let thisItemChildren = $(ui.item.context).find($(".autoform-array-item"));
        if (thisItemChildren.length > 0) updateChildrenSchemaKey(currKey, inputSchemaKey, thisItemChildren);
        // _.each(thisItemChildren, (child) => {
        //   let childSchemaKey =  $(child).find("input").attr("data-schema-key");
        //   console.log(childSchemaKey);
        // });
        console.log("********");

        // prints the schema key of the item in context
        // console.log($(ui.item.context).find("input").attr("data-schema-key"));

        // $(item).find("input").attr("data-schema-key", inputSchemaKey);
        // console.log(fromIdx, toIdx);

        // Update the siblings by shifting up or down
        _.each(arrayItemSiblings, function(item){
          let currItemSchemaKey = $(item).find("input").attr("data-schema-key")
            inputSchemaKey;
          let schemaFields = currItemSchemaKey.split('.');

          let schemaIdxToFix;
          if ($.isNumeric(schemaFields[schemaFields.length-1])){
            schemaIdxToFix = schemaFields.length-1;
          } else if ($.isNumeric(schemaFields[schemaFields.length-2])){
            schemaIdxToFix = schemaFields.length-2;
          }
          let thisItemNewIdx;
          let currIdx = parseInt(schemaFields[schemaIdxToFix]);
          if ((currIdx >= fromIdx && currIdx <= toIdx) || (currIdx <= fromIdx && currIdx >= toIdx)) {
            if (fromIdx < toIdx) {
              // Shift up
              console.log('shifting up');
              thisItemNewIdx = --currIdx;
              inputSchemaKey = updateSchemaKey(currItemSchemaKey, thisItemNewIdx);
            } else if (fromIdx > toIdx) {
              // Shift down
              console.log('shifting down');
              thisItemNewIdx = ++currIdx;
              inputSchemaKey = updateSchemaKey(currItemSchemaKey, thisItemNewIdx);
            }
            $(item).find("input:first").attr("data-schema-key", inputSchemaKey);
            $(item).find("input:first").attr("name", inputSchemaKey);
            $(item).find("select:first").attr("data-schema-key", inputSchemaKey);
            $(item).find("select:first").attr("name", inputSchemaKey);

            if (!!$(item).find(".medium-editor").attr("data-schema-key")){
              let currMediumEditorKey = $(item).find(".medium-editor").attr("data-schema-key");
              let updatedMediumEditorKey = updateSchemaKey(currMediumEditorKey, thisItemNewIdx);
              $(item).find(".medium-editor:first").attr("data-schema-key", updatedMediumEditorKey);
              $(item).find(".medium-editor:first").attr("name", updatedMediumEditorKey);
            }

            let thisItemChildren = $(item).find(".autoform-array-item");
            if (thisItemChildren.length > 0) updateChildrenSchemaKey(currItemSchemaKey, inputSchemaKey, thisItemChildren);

            //console.log("updated sibling: ", $(item).find("input").attr("data-schema-key"));
            //console.log("medium editor updated sibling: ",$(item).find(".medium-editor").attr("data-schema-key"));
          }
        });

      // END NEW CODE
      },
      start: function(event, ui){
        arrayItemSiblings = [];
        currKey = ui.item.find("input").attr("data-schema-key");
        let sibs = ui.item.siblings();
        _.each(sibs, function(sib){
          let key = $(sib).find("input").attr("data-schema-key");
          if (!!key) {
            arrayItemSiblings.push(sib);
          }
        });
        fromIdx = ui.item.index();
      }
    });
  }
};
