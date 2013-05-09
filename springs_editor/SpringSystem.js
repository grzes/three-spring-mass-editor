// Most of the actual spring system code copied from:
// http://www.netmagazine.com/tutorials/create-interactive-liquid-metal-ball-webgl

var Springs = function(signals) {
	this.points = [];
	this.run = false;
	this.selecting = false;
	this.selectedPoints = [];
	this.gravity = new THREE.Vector3(0, -1, 0).multiplyScalar(10.0);
	this.clock = new THREE.Clock();

	this.constraints = [];
	// TODO: When deleting points alsa remove all their constraints
	this.pointConstraints = {}

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

	signals.objectChanged.add( function ( object ) {
		if ( object instanceof Springs.Point) {
			object.velocity.set(0,0,0);
		}
		self.updateAttached();
	});

	signals.objectSelected.add( function ( object ) {
		if (!self.selecting) return;
		if ( object instanceof Springs.Point ) {
			self.selectedPoints.push(object);
			object.material.color.b = 0; // make it yellow
			//if (self.selectedPoints.length === 3) {
			//	self.selectedPoints[0].material.color.b = 1;
			//	self.selectedPoints.splice(0, 1);
			//}
		}
	});

	signals.addConstraints.add( function () {
		if (self.selectedPoints.length < 2) return;
		for (var i=1; i<self.selectedPoints.length; i++) {
			var c = new Springs.Constraint(self.selectedPoints[i-1], self.selectedPoints[i]);
			self.constraints.push(c);
			signals.objectAdded.dispatch( c );
		}
	});

	this.attached = 0;

	signals.attachMeshSelected.add( function(object) {
		if ((self.selectedPoints.length != 4) || !(object instanceof THREE.Mesh)) return;
		self.attached = object;
		// the 4 points that define our new coord space
		object.p0 = self.selectedPoints[0];
		object.p1 = self.selectedPoints[1];
		object.p2 = self.selectedPoints[2];
		object.p3 = self.selectedPoints[3];

		var v1 = new THREE.Vector3().subVectors(object.p1.position, object.p0.position),
			v2 = new THREE.Vector3().subVectors(object.p2.position, object.p0.position),
			v3 = new THREE.Vector3().subVectors(object.p3.position, object.p0.position);

		object.matrixAutoUpdate = false;
		object.geometry.verticesNeedUpdate = true;
		object.matrix.set(
			v1.x, v2.x, v3.x, 0,
			v1.y, v2.y, v3.y, 0,
			v1.z, v2.z, v3.z, 0,
			0,    0,    0,    1
		);

		var v, matrix = new THREE.Matrix4().getInverse(object.matrix);

		for (var i=0; i< object.geometry.vertices.length; i++) {
			object.geometry.vertices[i]
				.add(object.position)
				.sub(object.p0.position)
				.applyMatrix4(matrix);
		}
		self.updateAttached();
	})
	//setInterval(function() { self.update() }, 100);
}

Springs.prototype.resetVelocities = function () {
	var i = this.points.length;
	while (i--) {
		this.points[i].velocity.set(0, 0, 0);
	}
}

Springs.prototype.clearSelection = function () {
	var i = this.selectedPoints.length;
	while (i--) {
		this.selectedPoints[i].material.color.b = 1;
	}
	this.selectedPoints = [];
}

Springs.prototype.update = function() {
	if (!this.run) return;
	var delta, constraints, a, b, diff, i = this.constraints.length;
	while (i--) {
		constraint = this.constraints[i];
		a = constraint.a;
		b = constraint.b;
		diff = a.position.distanceTo(b.position) - constraint.length;
		delta = a.position.clone().subVectors(a.position, b.position).normalize();
		a.velocity.add(delta.clone().multiplyScalar(-diff*0.5));
		b.velocity.add(delta.multiplyScalar(diff*0.5));
		constraint.geometry.verticesNeedUpdate = true;
	}
	i = this.points.length;
	while (i--) {
		a = this.points[i];
		a.velocity.add(this.gravity);
	}
}

Springs.prototype.integrate = function() {
	if (!this.run) return;

	var p,
		i = 5,
		delta = this.clock.getDelta();
	while(i--) {
		this.update();
	}


	i = this.points.length;

	while (i--) {
		p = this.points[i];
		p.velocity.multiplyScalar(0.9);
		if (!p.isStatic) {
			p.position.add(p.velocity.clone().multiplyScalar(delta));
			if (p.position.y < 0) {
				p.position.y = 0;
				p.velocity.set(-p.velocity.x, -p.velocity.y, p.velocity.z);
			}
		}
	}
	this.updateAttached();
}

Springs.prototype.updateAttached = function() {
	if (this.attached) {
		var o = this.attached,
			v1 = new THREE.Vector3().subVectors(o.p1.position, o.p0.position),
			v2 = new THREE.Vector3().subVectors(o.p2.position, o.p0.position),
			v3 = new THREE.Vector3().subVectors(o.p3.position, o.p0.position);

		o.matrix.set(
			v1.x, v2.x, v3.x, o.p0.position.x,
			v1.y, v2.y, v3.y, o.p0.position.y,
			v1.z, v2.z, v3.z, o.p0.position.z,
			0,    0,    0,    1
		);
	}
}


Springs.Point = function (isStatic) {
	var geometry = new THREE.SphereGeometry( 5, 4, 2 );
	this.velocity = new THREE.Vector3(0, 0, 0);
	this.isStatic = isStatic || false;
	THREE.Mesh.call(this, geometry, new THREE.LineBasicMaterial() );
}
Springs.Point.prototype = Object.create( THREE.Mesh.prototype );


Springs.Constraint = function(a, b) {
	var geometry = new THREE.Geometry();
	this.a = a;
	this.b = b;
	geometry.vertices.push(a.position);
	geometry.vertices.push(b.position);
	this.length = a.position.distanceTo(b.position);
	THREE.Line.call(this, geometry, new THREE.LineBasicMaterial( { color: 0xffffff, opacity: 0.5 } ) );
}
Springs.Constraint.prototype = Object.create( THREE.Line.prototype );


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
		var point = new Springs.Point();
		point.name = 'Point ' + point.id;
		signals.objectAdded.dispatch( point );
	} );
	options.add( option );

	// add static point
	var option = new UI.Panel();
	option.setClass( 'option' );
	option.setTextContent( 'Static Point' );
	option.onClick( function () {
		var point = new Springs.Point(true);
		point.name = 'Static Point ' + point.id;
		signals.objectAdded.dispatch( point );
	} );
	options.add( option );

	// add constraints
	var option = new UI.Panel();
	option.setClass( 'option' );
	option.setTextContent( 'Constraint' );
	option.onClick( function () {
		signals.addConstraints.dispatch();
	} );
	options.add( option );

	// add constraints
	var option = new UI.Panel();
	option.setClass( 'option' );
	option.setTextContent( 'Attach Mesh' );
	option.onClick( function () {
		signals.attachMesh.dispatch();
	} );
	options.add( option );

	return container;
}


