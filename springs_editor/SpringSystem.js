// Most of the actual spring system code copied from:
// http://www.netmagazine.com/tutorials/create-interactive-liquid-metal-ball-webgl

var Springs = function(signals) {
	this.points = [];
	this.run = true;
	var self = this;

	signals.objectAdded.add( function ( object ) {
		if ( object instanceof Springs.Point ) {
			self.points.push(object);
		}
	});

	// removeSelectedObject doesn't dispatch the object as a param :()
	// So we hack around, when the scene changes, check which of our points was removed
	signals.selectedObjectRemoved.add( function ( object ) {
		if ( object instanceof Springs.Point) {
			self.points.splice(self.points.indexOf(object), 1);
		}
	});


	setInterval(function() { self.update() }, 1000);
}

Springs.prototype.update = function() {
	if (!this.run) return;
	console.log( 'updating', this.points.length );
	if (this.points.length) this.points[0].position.x = -this.points[0].position.x;
}

Springs.prototype.integrate = function() {
	if (!this.run) return;
	if (this.points.length) this.points[0].position.x *= 0.99;
}



Springs.Point = function () {
	var geometry = new THREE.SphereGeometry( 5, 4, 2 );
	THREE.Mesh.call(this, geometry, new THREE.LineBasicMaterial() );
}
Springs.Point.prototype = Object.create( THREE.Mesh.prototype );



Menubar.Springs = function ( signals ) {
	var container = new UI.Panel();
	container.setClass( 'menu' );
	container.onMouseOver( function () { options.setDisplay( 'block' ) } );
	container.onMouseOut( function () { options.setDisplay( 'none' ) } );
	container.onClick( function () { options.setDisplay( 'block' ) } );

	var title = new UI.Panel();
	title.setTextContent( 'Springs' ).setColor( '#666' );
	title.setMargin( '0px' );
	title.setPadding( '8px' );
	container.add( title );

	var options = new UI.Panel();
	options.setClass( 'options' );
	options.setDisplay( 'none' );
	container.add( options );

	// add point
	var option = new UI.Panel();
	option.setClass( 'option' );
	option.setTextContent( 'Point' );
	option.onClick( function () {
		var point = new Springs.Point()
		point.name = 'Point ' + point.id;
		signals.objectAdded.dispatch( point );
	} );
	options.add( option );
	return container;
}


