// pattern taken from http://stackoverflow.com/questions/881515/javascript-namespace-declaration
(function( map, $, _, events, undefined ) {
    var QA_DEFINITE_MAP_ICON = "http://qldarch.net/ns/rdf/2012-06/terms#definiteMapIcon";
    var QA_INDEFINITE_MAP_ICON = "http://qldarch.net/ns/rdf/2012-06/terms#indefiniteMapIcon";
    map.CLUSTER = "{{cluster}}";
    map.DEFAULT = "{{default}}";

    var olmap;

    var vectors;

    var hoverControl;

    var selectControl;

    var boxSelectControl;

    var searchButton;

    var markers;

    var highlighted;

    var clusterStrategy;

    var selectedId;

    map.events = events;

    map.icons = {
        hash: {}
    };

    //Public Method
    map.init = function(divid, icons) {
        map.icons = icons;
        var options = { };
        olmap = new OpenLayers.Map(divid, options);
        var gmap = new OpenLayers.Layer.Google(
            "Google Streets",
                {
                    numZoomLevels: 20,
                    sphericalMercator: true
                }
        );
        olmap.addLayers([gmap]);
        var defaultStyle = new OpenLayers.Style({
            pointRadius: 10,
            fillOpacity: 0.8,
            strokeColor: "black",
            externalGraphic: "${extGra}"
        }, {
            context: {
                extGra: function(feature) {
                    if(!_.isUndefined(feature.cluster)) {
                        return map.getMapIcon(map.CLUSTER, QA_INDEFINITE_MAP_ICON);
                    } else {
                        return map.getMapIcon(feature.attributes.type, QA_INDEFINITE_MAP_ICON);
                    }
                }
            }
        });
        var tmpStyle = new OpenLayers.Style({
            pointRadius: 12,
            externalGraphic: "${extGra}",
            fillOpacity: 1.0,
            strokeColor: "black",
            cursor: "pointer"
        }, {
            context: {
                extGra: function(feature) {
                    if(!_.isUndefined(feature.cluster)) {
                        return map.getMapIcon(map.CLUSTER, QA_INDEFINITE_MAP_ICON);
                    } else {
                        return map.getMapIcon(feature.attributes.type, QA_INDEFINITE_MAP_ICON);
                    }
                }
            }
        });
        var selectStyle = new OpenLayers.Style({
            pointRadius: 10,
            externalGraphic: "${extGra}",
            fillOpacity: 1.0,
            strokeColor: "black",
        }, {
            context: {
                extGra: function(feature) {
                    if(!_.isUndefined(feature.cluster)) {
                        return map.getMapIcon(map.CLUSTER, QA_DEFINITE_MAP_ICON);
                    } else {
                        return map.getMapIcon(feature.attributes.type, QA_DEFINITE_MAP_ICON);
                    }
                }
            }
        });
        clusterStrategy = new OpenLayers.Strategy.Cluster2({
            distance: 20,
            threshold: 2,
        });
        clusterStrategy.events.on({"beforecluster": function() {
            selectControl.unselectAll();
        }});
        clusterStrategy.events.on({"aftercluster": function() {
            if(selectedId) {
                map.selectFeature(selectedId);
            }
        }});
        vectors = new OpenLayers.Layer.Vector("Vector Layer", {
            styleMap:
                new OpenLayers.StyleMap({
                    "default": defaultStyle,
                    "temporary": tmpStyle,
                    "select": selectStyle
                }), 
            strategies: [clusterStrategy]
        });
        olmap.addLayer(vectors);
        hoverControl = new OpenLayers.Control.SelectFeature(
            [vectors], {
                hover: true,
                highlightOnly: true,
                renderIntent: "temporary",
                eventListeners: {
                    beforefeaturehighlighted: function(e) {
                        if ((highlighted != null) &&
                                (highlighted.attributes.id != e.feature.attributes.id)) {
                            events.disable();
                            hoverControl.unhighlight(highlighted);
                            highlighted=null;
                            events.enable();
                      }
                    },
                    featurehighlighted: function(e) {
                        events.fire({
                            type: "mapHighlight",
                            id: e.feature.attributes.id
                        })
                    },
                    featureunhighlighted: function(e) {
                        events.fire({
                            type: "mapUnHighlight",
                            id: e.feature.attributes.id
                        })
                    }
                }
            }
        );
        olmap.addControl(hoverControl);
        hoverControl.activate();
        selectControl = new OpenLayers.Control.SelectFeature(
            [vectors], {
                hover: false, 
                clickout: false,
                multiple: false,
                toggle: false,
                renderIntent: "select"
            }
        );
        olmap.addControl(selectControl);
        selectControl.handlers.feature.callbacks.click = function(feature) {
            events.fire({
                type: "selected",
                feature: feature});
        };
        selectControl.activate();
        // don't add the boxSelectControl to any layer
        // we only use is as a tool to draw a box select for the map search feature
        // not for actually selecting anything.
        boxSelectControl = new OpenLayers.Control.SelectFeature([], {
            box: true,
            selectBox: function(position) {
                if (position instanceof OpenLayers.Bounds) {
                    var minXY = this.map.getLonLatFromPixel({
                        x: position.left,
                        y: position.bottom
                    });
                    var maxXY = this.map.getLonLatFromPixel({
                        x: position.right,
                        y: position.top
                    });
                    var bounds = new OpenLayers.Bounds(
                        minXY.lon, minXY.lat, maxXY.lon, maxXY.lat
                    );
                    olmap.zoomToExtent(bounds);
                    bounds = bounds.transform(olmap.getProjectionObject(),
                            new OpenLayers.Projection("EPSG:4326"));
                    if(searchButton.active) {
                        searchButton.trigger();
                    }
                    events.fire({
                        type: "mapsearch",
                        bounds: bounds
                    });
                }
            }
        });
        olmap.addControl(boxSelectControl);
        searchButton = new OpenLayers.Control.Button({
            id: 'msearch',
            text: 'S',
            title: 'Map Search, draw a box on the map',
            displayClass: "olSearchMapBox",
            mouseenter: function(div) {
                jQuery(div).css('background', 'none repeat scroll 0 0 rgba(0, 60, 136, 0.7)');
            },
            mouseleave: function(div) {
                jQuery(div).css('background', '');
            },
            trigger: function() {
                if(this.active) {
                    this.deactivate();
                    boxSelectControl.deactivate();
                } else {
                    this.activate();
                    boxSelectControl.activate();
                }
            }
        });
        var panel = new OpenLayers.Control.Panel({
            createControlMarkup: function(control) {
                var div = document.createElement("div");
                if(control.text) {
                    div.innerHTML = control.text;
                }
                if(control.id) {
                    div.id = control.id;
                }
                if(control.mouseenter) {
                    jQuery(div).mouseenter(function() {
                        control.mouseenter(div);
                    });
                }
                if(control.mouseleave) {
                    jQuery(div).mouseleave(function() {
                        control.mouseleave(div);
                    });
                }
                return div;
            }
        });
        panel.addControls([searchButton]);
        olmap.addControl(panel);
        map.centerAustralia();
    };

    map.getMap = function() {
        return olmap;
    };

    map.getMapIcon = function(featureType, iconType) {
        if (map.icons.hash && featureType &&
            map.icons.hash[featureType] &&
            map.icons.hash[featureType][iconType]) {
            return map.icons.hash[featureType][iconType];
        } else {
            return map.icons.hash[map.DEFAULT][iconType];
        }
    };

    map.replaceMarkers = function(markers) {
        selectedId = null;
        map.removeMarkers();
        // fix don't add markers one by one because that confuses the cluster strategy. instead
        // prepare the tmp feature array and add all features in one go.
        var tmp = [];
        $.each(markers, function(index, value) {
            if(value.lon != "" && value.lat!="") {
                var point = new OpenLayers.Geometry.Point(value.lon, value.lat);
                point.transform(new OpenLayers.Projection("EPSG:4326"), olmap.getProjectionObject());
                var feature = new OpenLayers.Feature.Vector(point, {id: value.id, label: value.label, type: value.type});
                tmp.push(feature);
            }
        });
        vectors.addFeatures(tmp);
        events.fire({
            type: "vectorschanged",
        })
    };

    map.removeMarkers = function() {
        // workaround: also remove cached features from the cluster strategy,
        // otherwise they might find there way back on the map e.g. on panning and zooming.
        clusterStrategy.features = null;
        highlighted = null;
        vectors.removeAllFeatures();
        this.closePopups();
    };

    map.closePopups = function() {
        $.each(olmap.popups, function(index, popup) {
            popup.hide();
        });
    };

    map.zoomToMarkers = function() {
        map.zoomToFeatures(vectors.features);
    };

    map.zoomToCluster = function(cluster) {
        if (!_.has(cluster, "cluster")) {
            map.zoomToMarkers();
        } else {
            map.zoomToFeatures(cluster.cluster);
        }
    };

    map.zoomToFeatures = function(features) {
        if(features.length == 0) {
            map.centerAustralia();
        } else if(features.length == 1) {
            var lonlat = new OpenLayers.LonLat(features[0].geometry.x, features[0].geometry.y);
            olmap.setCenter(lonlat, 16, false, false);
        } else {
            var bounds = new OpenLayers.Bounds();
            $.each(features, function(index, feature) {
                bounds.extend(feature.geometry.getBounds());
            });
            olmap.zoomToExtent(bounds);
        }
    };

    map.updateSize = function() {
        if(olmap!=null) {
            olmap.updateSize();
        }
    };

    map.getExtent = function() {
        return olmap.getExtent().transform(olmap.getProjectionObject(),
                new OpenLayers.Projection("EPSG:4326"));
    };

    map.getCenterLon = function() {
        return olmap.getCenter().transform(olmap.getProjectionObject(),
                new OpenLayers.Projection("EPSG:4326")).lon;
    };

    map.getCenterLat = function() {
        return olmap.getCenter().transform(olmap.getProjectionObject(),
                new OpenLayers.Projection("EPSG:4326")).lat;
    };

    map.getZoom = function() {
        return olmap.getZoom();
    };

    map.setCenter = function(lon, lat, zoom) {
        var lonlat = new OpenLayers.LonLat(lon, lat);
        lonlat.transform(new OpenLayers.Projection("EPSG:4326"), olmap.getProjectionObject());
        olmap.setCenter(lonlat, zoom, false, false);
    };

    map.centerAustralia = function() {
        var aucenter = new OpenLayers.LonLat(134.866944, -24.994167).transform(
                new OpenLayers.Projection("EPSG:4326"), new OpenLayers.Projection("EPSG:900913"));
        olmap.setCenter(aucenter,4);
    };

    map.unselectAll = function() {
        events.disable();
        selectControl.unselectAll();
        events.enable();
    };

    
    map.centerMarker = function(id, zoom) {
        var feature = map.getFeatureOrCluster(id);
        if(feature!=null) {
            if(!_.isUndefined(zoom)) {
                olmap.zoomTo(zoom);
            }
            olmap.panTo(new OpenLayers.LonLat(feature.geometry.x, feature.geometry.y));
            map.selectFeature(id);
        }
    };

    map.selectMarker = function(id) {
        map.selectFeature(id);
    };

    map.popup = function(content, width) {
        // open popup window on the map in the top left corner
        // but push the popup 50 pixel to the right so is does not interefere with the map controls
        var lonlat = olmap.getLonLatFromPixel(new OpenLayers.Pixel(50,10));
        var popup = new OpenLayers.Popup(
                null,
                lonlat,
                null,
                content,
                true
            );
        popup.autoSize = true;
        var mapSize = olmap.size;
        // width refers to the popups content width so we need to add some pixel (48) to come to the 
        // total width of the popup. 48 pixel were measured on firefox in ubuntu could be more or 
        // less on other browsers/platforms i guess that is why we add another 20 pixel. 
        // The absolute maximum width is the map size width - 100 pixel (because we pushed the popup
        // 50 pixel to the right that leaves 50 pixel on the left).
        popup.maxSize = new OpenLayers.Size(Math.min(width+48+20,mapSize.w-100), mapSize.h-20);
        popup.setBorder("1px solid black")
        popup.closeOnMove = false;
        popup.setOpacity(0.85);
        // add an exclusive popup, meaning that all other popups are closed
        olmap.addPopup(popup,true);
        jQuery('#'+popup.id).corner();
    };

    map.getMarker = function(featureId) {
        return map.getFeatureOrCluster(featureId);
    };

    map.highlight = function(id) {
        var feature = map.getFeatureOrCluster(id);
        if(feature) {
            feature.layer.drawFeature(feature, 'temporary');
        }
    };

    map.unhighlight = function(id) {
        var feature = map.getFeatureOrCluster(id);
        if(feature) {
            if($.inArray(feature, feature.layer.selectedFeatures) == -1) {
                feature.layer.drawFeature(feature, 'default');
            } else {
                feature.layer.drawFeature(feature, 'select');
            }
        }
    };

    map.getSelectedId = function() {
        return selectedId;
    };

    map.idInCluster = function(cluster, id) {
        return isInCluster(cluster,id);
    };

    map.featuresOnScreen = function() {
        return _.filter(vectors.features, function(feature) {
            return feature.onScreen();
        } );
    };

    map.selectMapFeature = function(feature) {
        selectControl.unselectAll();
        if (!_.isUndefined(feature) && _.contains(map.featuresOnScreen(), feature)) {
            selectControl.select(feature);
        }
    };

    map.getFeatureOrCluster = function(id) {
        for(var i=0;i<vectors.features.length;i++) {
            var feature = vectors.features[i];
            if(feature.attributes.id==id) {
                return feature;
            }
            // it might also be clustered
            if(isInCluster(feature, id)) {
                return feature;
            }
        }
        return null;
    };

    map.getFeatureFromCluster = function(cluster, id) {
        if(!_.isUndefined(cluster.cluster)) {
            for(var i=0;i<cluster.cluster.length;i++) {
                var clustered = cluster.cluster[i];
                if(clustered.attributes.id === id) {
                    return clustered;
                }
            }
        }
        return undefined;
    };

    //Private Method
    function isInCluster(feature, id) {
        return !_.isUndefined(map.getFeatureFromCluster(feature, id));
    };

    map.selectFeature = function(id) {
        var feature;
        feature = map.getFeatureOrCluster(id);
        selectedId = id;
        if(feature!=null) {
            events.disable();
            selectControl.unselectAll();
            selectControl.select(feature);
            events.enable();
        }
    };

}( window.map = window.map || {}, jQuery, _, events ));
