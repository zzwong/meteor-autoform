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

  if (!! this.data.enableSorting) {
    var listGroup = $(this.find(".list-group"));

    if (! listGroup.sortable) {
      throw new Error("Sortable arrays require jQuery UI");
    }

    listGroup.sortable({
      handle: ".autoform-drag-item",
      cancel: ".autoform-add-item-wrap",
      update: function(event, ui){

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
            childSchemaKey = childSchemaKey.replace(preUpdateKey, postUpdateKey);
            $(child).find("input:first").attr("data-schema-key", childSchemaKey);
            $(child).find("input:first").attr("name", childSchemaKey);
            $(child).find("select:first").attr("data-schema-key", childSchemaKey);
            $(child).find("select:first").attr("name", childSchemaKey);
            // unlikely to have medium editor
            // if (!!$(child).find(".medium-editor").attr("data-schema-key")){
            //   let currMediumEditorKey = $(child).find(".medium-editor").attr("data-schema-key");
            // }
          });
        };

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

        let thisItemChildren = $(ui.item.context).find($(".autoform-array-item"));
        if (thisItemChildren.length > 0) updateChildrenSchemaKey(currKey, inputSchemaKey, thisItemChildren);

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
          }
        });
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
