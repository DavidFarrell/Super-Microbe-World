import ebug.Entity;
import ebug.junior.PlatformGame;
import ebug.Constants;
import ebug.junior.*;
import ebug.ParticleSystem;

/**
 * @author sbbc231
 */
class ebug.junior.CameraFlashEntity extends GameEntity {
 	public static var CAMERA_STATE_NORMAL : Number = 100;
 	public static var CAMERA_STATE_DEAD : Number = 102;

	public var fadeSpeed : Number;
	public var faceCount : Number;
	
	public var shotTaken : Boolean;
 	
 	public function CameraFlashEntity(inGame : PlatformGame, inParticle:Entity, inClip:MovieClip) {
		super(inGame,inParticle, inClip);
		counterCeiling = 1;
		thinkTime = 0;
		particle.theParent = this;
		
		shotTaken = false;
		
		particle.isDynamic = true;
		particle.gravityExcempt = true;
		particle.physicsExcempt = false;
		
		state = CAMERA_STATE_NORMAL;
	}

	public function advance() : Array {
		var events : Array = new Array();
		
		switch (state) {
			case CAMERA_STATE_NORMAL : 
				events = takeShot();
				break;
			case CAMERA_STATE_DEAD :
				//events.push(new Event(Event.REMOVE, this, null));
				break;
		}
		return events;
	}
	
	public function act(e : Event) : Array {
		var events : Array = null;
		switch (e.type) {
			case Event.COLLIDE :
				if (e.params[0] instanceof Microbe ) {
					var microbe : Microbe = Microbe(e.params[0]);
					if (!microbe.hasBeenPhotographed) {
						shotTaken = true;
						var photographEvent : Event = new Event(Event.BE_PHOTOGRAPHED, e.params[0], null);
						theGame.entityEvents.push(photographEvent);
					}
				} 
				break;
			case Event.REMOVE :
				remove();
				
		}
		
		
		return events;	
	}
	
	public function takeShot() : Array {
		var events : Array = new Array();
		
		clip._alpha -= 10;
		if ( clip._alpha <= 0 ) {
			events.push(new Event(Event.REMOVE, this, null));
			state = CAMERA_STATE_DEAD;
		}
		
		for ( var i = 0;i < theGame.entities.length && !shotTaken; i++ ) {
			if ( theGame.entities[i] instanceof Microbe ) {
				if ( clip.hitTest(theGame.entities[i].clip)) {
					var params : Array = new Array();
					params.push(theGame.entities[i]);
					events.push(new Event(Event.COLLIDE, this, params));
					shotTaken = true;	
				}				
			} 
		}
		
		return events;
	}
	
	public function remove() : Void {
		particle.physicsExcempt = true;
	//	delete(particle);
		//clip.removeMovieClip();
		clip._visible = false;
	}
}
//eof