import ebug.Entity;
import ebug.junior.PlatformGame;
import ebug.Vector3;
import ebug.junior.*;
import ebug.ParticleSystem;
import ebug.Constants;

/**
 * @author sbbc231
 */
class ebug.junior.AntibioticBombEntity extends GameEntity {
 	public static var BOMB_STATE_FALLING : Number = 100;
 	public static var BOMB_STATE_COUNTING_DOWN : Number = 101;
 	public static var BOMB_STATE_EXPLODE : Number = 102;
 	 	 	
 	var bombTimer : Number;
 	var explodeSeconds : Number;
	var minimumSpeedTrigger : Number;
	
	public function AntibioticBombEntity(inGame : PlatformGame, inParticle:Entity, inClip:MovieClip) {
		super(inGame,inParticle, inClip);
		counterCeiling = 1;
		thinkTime = defaultThinkTime = 3;
		particle.theParent = this;
		
		particle.isDynamic = true;
		particle.gravityExcempt = false;
		particle.physicsExcempt = false;
		state = BOMB_STATE_FALLING;
		
		minimumSpeedTrigger = 2;
		bombTimer = 0;
		explodeSeconds = 2000; // time to pass in millis
	}

	public function advance() : Array {
		var events : Array = new Array();
		switch (state) {
			case BOMB_STATE_FALLING : 
				if ( Math.abs(particle.position.y - particle.previousPosition.y) <= minimumSpeedTrigger ) {
					state = BOMB_STATE_COUNTING_DOWN;
					bombTimer = getTimer();
				}
				break;
			case BOMB_STATE_COUNTING_DOWN :
				if ( bombTimer + explodeSeconds <= getTimer() ) {
					state = BOMB_STATE_EXPLODE;
				}
				break;
			case BOMB_STATE_EXPLODE :
			
				events.push(new Event(Event.EXPLODE_ANTIBIOTIC, this, null));
				events.push(new Event(Event.REMOVE, this, null));
				break;
		}	
		return events;
	}
	
	public function act(e : Event) : Array {
		var events : Array = new Array();
		if (e.type == Event.REMOVE) {
			remove();
		}
		return events;	
	}
	
	public function remove() : Void {
		particle.physicsExcempt = true;
		delete(particle);
		clip.removeMovieClip();
		clip._visible = false;
		state = GameEntity.GAME_ENTITY_STATE_IGNORE;
	}
}
//eof