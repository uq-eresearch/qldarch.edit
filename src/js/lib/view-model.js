// Backbone.ViewModel v0.1.0
//
// Copyright (C)2012 Tom Hallett
// Distributed Under MIT License
//
// Documentation and Full License Available at:
// http://github.com/tommyh/backbone-view-model

Backbone.ViewModel = (function(Backbone, _, undefined){
    'use strict';

    var Model = Backbone.Model;
    var ViewModel = Model.extend({
        constructor: function(attributes, options) {
            Model.apply(this, [attributes, options]);
            this.initializeViewModel();
        },
        initializeViewModel: function(){
            this.set(this.get("source_models"));
            this.source_models = _.union(
                _.values(this.get('source_models')),
                (this.get('source_model') || []));

            this.setComputedAttributes();
            this.bindToChangesInSourceModel();
        },

        setComputedAttributes: function(){
            _.each(this.computed_attributes, function(value, key){
                var val = value.call(this);
                this.set(key, val);
            }, this);
        },

        bindToChangesInSourceModel: function(){
            _.each(this.source_models, function(model) {
                model.on("change", this.setComputedAttributes, this);
                model.on("add", this.setComputedAttributes, this);
                model.on("remove", this.setComputedAttributes, this);
                model.on("reset", this.setComputedAttributes, this);
            }, this);
        }

    });

    return ViewModel;
})(Backbone, _);

Backbone.ViewCollection = (function(Backbone, _, undefined) {
    'use strict';

    var Model = Backbone.Model;
    var Collection = Backbone.Collection;

    var ViewCollection = Collection.extend({
        constructor: function(options) {
            Collection.apply(this, [[], options]);

            this.options = options;
            this.sources = options.sources;
            this.trackSort = !!options.trackSort;
            this.name = (options.name || "Unnamed ViewCollection");
            this.debounce = options.debounce;
            this.initializeViewCollection();
        },

        initializeViewCollection: function() {
            this.setComputedAttributes();
            this.bindToChangesInSources();
        },

        setComputedAttributes: function() {
            var cma = this.computeModelArray();
            this.set(cma);
        },

        bindToChangesInSources: function(){
            var setAttr = _.isUndefined(this.debounce) ?
                this.setComputedAttributes :
                _.debounce(this.setComputedAttributes, this.debounce, true);

            _.each(this.sources, function(collection, key) {
                this.listenTo(collection, "add", setAttr, this);
                this.listenTo(collection, "remove", setAttr, this);
                this.listenTo(collection, "reset", setAttr, this);
                this.listenTo(collection, "change", setAttr, this);
                this.listenTo(collection, "destroy", setAttr, this);
                if (this.trackSort) {
                    this.listenTo(collection, "sort", setAttr, this);
                }
            }, this);
        }
    });

    return ViewCollection;
})(Backbone, _);
