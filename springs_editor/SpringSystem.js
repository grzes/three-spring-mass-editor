var Springs = function(signals) {
	this.points = [];
	this.run = false;
	this.selecting = false;
	this.selectedPoints = [];
	this.gravity = new THREE.Vector3(0, -1, 0).multiplyScalar(10.0);

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
			object.oldPosition.copy(object.position);
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

Springs.prototype.satisfy = function() {
	var c, diff, delta;
	for (var t=0; t<5; t++) {
		for (var i=0; i<this.constraints.length;i++) {
			c = this.constraints[i];

			delta = new THREE.Vector3().subVectors(c.b.position, c.a.position);
			delta.multiplyScalar(c.length / (c.length + delta.length()) - 0.5);
			//  length now means squere!
			c.a.position.sub(delta);
			c.b.position.add(delta);
			c.geometry.verticesNeedUpdate = true;
		}
	}
}


Springs.prototype.integrate = function() {
	if (!this.run) return;

	this.satisfy();

	var p, i = this.points.length,
		tmp = new THREE.Vector3(),
		delta = new THREE.Vector3(),
		gravity = new THREE.Vector3(0, -0.01, 0),
		DAMP = 0.96;

	while(i--) {
		p = this.points[i];
		if (p.isStatic) {
			p.position.copy(p.oldPosition);
		} else {
			tmp.copy(p.position);

			delta.subVectors(p.position, p.oldPosition).add(gravity);
			p.position.add(delta.multiplyScalar(DAMP));
			p.oldPosition.copy(tmp);
			if (p.position.y < 0) p.position.y = 0;
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
	this.oldPosition = new THREE.Vector3(0,0,0);
	THREE.Mesh.call(this, geometry, new THREE.LineBasicMaterial() );
}
Springs.Point.prototype = Object.create( THREE.Mesh.prototype );


Springs.Constraint = function(a, b) {
	var geometry = new THREE.Geometry();
	this.a = a;
	this.b = b;
	geometry.vertices.push(a.position);
	geometry.vertices.push(b.position);
	geometry.verticesNeedUpdate = true;
	//this.lengthSq = a.position.distanceToSquared(b.position);
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


