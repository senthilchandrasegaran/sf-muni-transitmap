var mapWidth = d3.select("#mapDiv").attr("width");

var mapSvg = d3.select('#sf_map');
var mapHeight = $(window).height();
mapSvg
  .style("height", mapHeight)
  .style("width", mapWidth);

var defaultScale = 310000;  // trial and error for current viewport

// Map setup with SF coordinates
var projection = d3.geoMercator()
    .center([-122.56, 37.773]) // [longitude, latitude]
    .scale(defaultScale)
    .translate([mapWidth/2, mapHeight/2]);

var path = d3.geoPath()
    .projection(projection)

var transform = d3.zoomIdentity;
var zoom = d3.zoom()
    .scaleExtent([1, 15]) // relative to current scale
    .on("zoom", zoomed);

var drag = d3.drag()
    .on("drag", dragged);

var g = mapSvg.append("g")
    .call(zoom)
    .call(drag);

// create groups in order to ensure streets lay on top of neighborhoods,
// routes on top of streets, and buses on top of routes.
g.append("g").attr("id", "neighborhoods");
g.append("g").attr("id", "streets");
g.append("g").attr("id", "routes");
g.append("g").attr("id", "buses");


// URL for SF Muni feed
var routesAPI = "http://webservices.nextbus.com/service/publicJSONFeed?";
var routesAPIforBuses = "http://nextbusproxy.herokuapp.com/service/publicJSONFeed?";

// execute functions to plot map
plotNeighborhoods("./data/neighborhoods.json");
plotStreets("./data/streets.json");

// populate left column with list of available routes,
// and initialize one selection
populateRouteList(routesAPI);

// initialize a "selected route" for the default view when the page is
// first loaded
var selectedRoute = "14";
// maintain a list of currently-selected routes, using it to decide
// whether or not to show buses. As default, this will have one item,
// the "currently selected" route.
var selectedRouteList = [selectedRoute]

var areRoutesPlotted = false;

// execute functions to draw selected routes and buses on route
$(".table-wrapper").on("click", ".check", function(e) {
  var boxChecked = $(this).is(':checked');
  var boxID = $(this).attr("id");
  if (boxChecked){
    // add current box ID to selected Route
    selectedRouteList.push(boxID);
    // plot corresponding routes and buses
    plotRoutes(routesAPI, boxID);
  } else {
    // remove current box ID from selected Route
    selectedRouteList.pop(boxID);
    // remove corresponding route paths and buses
    toRemove = d3.select("#routes").selectAll("g.route-"+boxID);
    toRemove.remove();
    d3.select("#buses").selectAll("circle.route-" + boxID).remove();
  }
});

// get ALL buses every 15 seconds
// (minimizes query frequency when multiple routes are chosen)
(function worker() {
  var currentTime = new Date().getTime();
  d3.json(routesAPIforBuses+"command=vehicleLocations&a=sf-muni&t="+currentTime,
      function(data){
        // if only one bus is returned, it is not returned as an array.
        // Convert this object into an array if needed.
        if (!Array.isArray(data.vehicle)) {
          data.vehicle = [data.vehicle];
        }
        var vehicleLocations = data.vehicle;
        // vehLoc = vehicleLocations.vehicle;
        // console.log(vehicleLocations.vehicle);
        if (areRoutesPlotted) {
          updateBuses(selectedRouteList, vehicleLocations);
        }

        setTimeout(worker, 15000); // NEVER set timeout below 10000ms
      });

  /*
  $.getJSON(routesAPI,
            {format: "json",
             command: "vehicleLocations",
             a : "sf-muni",
             //r : routeID,
             t : currentTime})
    .done(function(data) {
      // if only one bus is returned, it is not returned as an array.
      // Convert this object into an array if needed.
      if (!Array.isArray(data.vehicle)) {
        data.vehicle = [data.vehicle];
      }
      var vehicleLocations = data.vehicle;
      // vehLoc = vehicleLocations.vehicle;
      // console.log(vehicleLocations.vehicle);
      updateBuses(selectedRouteList, vehicleLocations);

    setTimeout(worker, 15000); // NEVER set timeout below 10000ms
  });
  */

})();


function plotNeighborhoods(hoodsFilePath){
  // plot neighborhoods
  d3.json(hoodsFilePath, function(error, sf_hoods){
    if (error) return console.error(error);

    d3.select("#neighborhoods")
      .selectAll("path")
        .data(sf_hoods.features)
        .enter().append("path")
        .attr("d", path)
        .attr("z-index", -1)
        .attr("fill", "#e0deda");
  });
}

function plotStreets(streetsFilePath){
  d3.json(streetsFilePath, function(error, sf_st){
    if (error) return console.error(error);

    d3.select("#streets")
      .selectAll("path")
        .data(sf_st.features)
        .enter().append("path")
        .attr("fill", "rgba(1,1,1,0)")
        .attr("stroke-width", "1px")
        .attr("stroke", "#fff")
        .attr("z-index", 0)
        .attr("d", path);
  });
}

function populateRouteList(routesURL){
  /* LIST OF STOPS ON A ROUTE
   * https://webservices.nextbus.com/service/publicJSONFeed?command=routeConfig&a=sf-muni&r=N
   * */
  d3.json(routesURL+"command=routeConfig&a=sf-muni",
      function(data){
        routeList = data.route;
        // sort routeList by tag for some form of order
        routeList.sort(compare);

        for (var i=0; i<routeList.length; i++){
          rowContent = "<tr>" +
            "<td width=15px style='background-color : #"+
            routeList[i].color +"'></td>" +
            "<td>" +
            "<input id='"+ routeList[i].tag +"' type='checkbox' class='check'>" +
            "</td>" +
            "<td>" + routeList[i].title + "</td>" +
            "</tr>";
          $("#routeTable").append(rowContent);

          // initialize checkbox with a default selection
          if (routeList[i].tag === selectedRoute){
            $("#" +selectedRoute).prop('checked', true);
          }
        }

        // also plot one route and bus by default
        plotRoutes(routesAPI, selectedRoute);
  });
  /*
  $.getJSON(routesURL,
            {format: "json",
             command: "routeConfig",
             a : "sf-muni"})
    .done(function(data) {
      routeList = data.route;
      // sort routeList by tag for some form of order
      routeList.sort(compare);

      for (var i=0; i<routeList.length; i++){
        rowContent = "<tr>" +
          "<td width=15px style='background-color : #"+
          routeList[i].color +"'></td>" +
          "<td>" +
          "<input id='"+ routeList[i].tag +"' type='checkbox' class='check'>" +
          "</td>" +
          "<td>" + routeList[i].title + "</td>" +
          "</tr>";
        $("#routeTable").append(rowContent);

        // initialize checkbox with a default selection
        if (routeList[i].tag === selectedRoute){
          $("#" +selectedRoute).prop('checked', true);
        }
      }

      // also plot one route and bus by default
      plotRoutes(routesAPI, selectedRoute);
  });
  */
}

function plotRoutes(routesURL, routeID){
  // draw the selected route
  d3.json(routesURL+"command=routeConfig&a=sf-muni&r="+routeID,
      function(data){
        var routeColor = "#"+ data.route.color;
        var routePaths = data.route.path;
        var routePathLineCollection = lineStringsFromPoints(routePaths);

        d3.select("#routes").append("g")
          .attr("class", "route-"+routeID)
          .selectAll("path")
            .data(routePathLineCollection)
            .enter().append("path")
            .attr("class", "route-"+routeID)
            .attr("fill", "rgba(1,1,1,0)")
            .attr("stroke-width", "1px")
            .attr("stroke", routeColor)
            .attr("z-index", 10)
            .attr("d", path);
      });

  areRoutesPlotted = true;
  /*
  $.getJSON(routesURL,
            {format: "json",
             command: "routeConfig",
             a : "sf-muni",
             r : routeID})
    .done(function(data) {
      var routeColor = "#"+ data.route.color;
      var routePaths = data.route.path;
      var routePathLineCollection = lineStringsFromPoints(routePaths);

      d3.select("#routes").append("g")
        .attr("class", "route-"+routeID)
        .selectAll("path")
          .data(routePathLineCollection)
          .enter().append("path")
          .attr("class", "route-"+routeID)
          .attr("fill", "rgba(1,1,1,0)")
          .attr("stroke-width", "1px")
          .attr("stroke", routeColor)
          .attr("z-index", 10)
          .attr("d", path);
  });
  */

}

function updateBuses(routeList, vLoc){
  // function to update bus locations for each selected route
  // if routeList is empty, exit from function.
  if (routeList.length < 1)
    return false;
  // created a filtered list of vehicle locations.
  // Necessary to do this outside the next loop to make sure the data to
  // the d3 buses objects is consistent, or only the buses from the last
  // selected route are shown
  var fVLoc = [];
  for (var ri=0; ri < routeList.length; ri++){
    fVLoc = fVLoc.concat(vLoc.filter(function(d){
      return d.routeTag == routeList[ri];
    }));
  }
  console.log(fVLoc);

  // get route color from paths

  // loop through every route and update buses
  for (var routeInd=0; routeInd < routeList.length; routeInd++){

    // filter vehicle location for specified route
    var specRoute = routeList[routeInd];
    var busColor = $("g#routes path.route-"+specRoute).first().attr("stroke");

    var t = d3.transition()
        .duration(5000);

    // Data join, i.e. join new buses with old.
    bus = g.select("#buses").selectAll(".route-"+specRoute)
        .data(fVLoc,
              function(d) {
                // a unique key for d3 to keep track of updates,
                // enters, and exits. We combine the ID tag with the
                // direction tag (inbound/outbound) to ensure
                // uniqueness. Need to check for all routes.
                return d.id + "-" + d.dirTag;
              });

    bus.transition(t)
      .attr("transform", function(d) {
        return "translate(" + projection([d.lon, d.lat])[0] + ","
          + projection([d.lon, d.lat])[1] + ")";
      })

    var enteredBuses = bus.enter().append("g")
      .attr("class", function(d) {return "route-"+d.routeTag;})
      .attr("id", function(d){
        return d.id + "-" + d.dirTag;
      })
      .attr("transform", function(d) {
        return "translate(" + projection([d.lon, d.lat])[0] + ","
          + projection([d.lon, d.lat])[1] + ")";
      })

    enteredBuses.append("circle")
      .attr("stroke", "#003399")
      .attr("fill", function(d) {
        return  d3.select("g#routes path.route-"+ d.routeTag).attr("stroke");
      })
      .attr("stroke-width", "0px")
      //.attr("class", "route-" + specRoute)
      .attr("r", "7px");

    enteredBuses.append("text")
      .text(function(d) {return d.routeTag;})
      .attr("font-size", "7px")
      .attr("text-anchor", "middle")
      .attr("fill", "#fff")
      .attr("alignment-baseline", "middle");

    bus.exit().remove();


  }
}

function lineStringsFromPoints(pointObjList){

  var routePathLineCollection = [];

  for (var i=0;i<pointObjList.length;i++){

    var pointArray = pointObjList[i].point;
    // Each "pointArray" is of the form:
    //   { point : [ { lat: "lat", lon: "lon"}, ... ] }
    // And this array needs to be converted to:
    //   { type: "Feature",
    //     geometry: { type: "LineString",
    //                 coordinates: [ [lon, lat, z], ...] }
    //   }
    var coordList = [];
    for (var ind=0; ind<pointArray.length; ind++){
      var lon = +pointArray[ind].lon; // convert str to float
      var lat = +pointArray[ind].lat;
      var z = 0;
      coordList.push([lon, lat, z]);
    }
    var outputLineString = { type : "Feature",
                             geometry : {type : "LineString",
                                         coordinates : coordList} };

    routePathLineCollection.push(outputLineString);
  }
  return(routePathLineCollection);
}

// allow dragging & zooming behavior
// code reference from https://bl.ocks.org/mbostock/2206340
// and https://bl.ocks.org/mbostock/3127661b6f13f9316be745e77fdfb084
function zoomed() {
  g.attr("transform", d3.event.transform);
}

function dragged(d){
  d3.select(this)
    .attr("cx", d.x = d3.event.x)
    .attr("cy", d.y = d3.event.y);
}

function compare(a,b){
  // sort routelist by tag to ensure the table is consistently populated
  if (a.tag < b.tag)
    return -1;
  if (a.tag > b.tag)
    return 1;
  return 0;
}

/* COMMANDS FOR SF MUNICIPALITY
https://webservices.nextbus.com/service/publicJSONFeed?command=agencyList&a=sf-muni
*/

/* ROUTE LIST
 * https://webservices.nextbus.com/service/publicJSONFeed?command=routeList&a=sf-muni
 */

/* LIST OF STOPS ON A ROUTE
 * https://webservices.nextbus.com/service/publicJSONFeed?command=routeConfig&a=sf-muni&r=N
 */

