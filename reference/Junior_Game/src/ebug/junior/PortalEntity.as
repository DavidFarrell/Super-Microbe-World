import ebug.Entity;
import ebug.junior.PlatformGame;
import ebug.Constants;
import ebug.junior.*;
import ebug.ParticleSystem;

/**
 * @author sbbc231
 */
class ebug.junior.PortalEntity extends GameEntity {
	public static var PORTAL_STATUS_CLOSED : Number = 100;
	public static var PORTAL_STATUS_OPEN : Number = 101;

	public static var PORTAL_EVENT_OPEN : Number = 50;
	public static var PORTAL_EVENT_CLOSE : Number = 51;


	public function PortalEntity(inGame : PlatformGame, inParticle:Entity, inClip:MovieClip) {
		super(inGame,inParticle, inClip);
		counterCeiling = 1;
		thinkTime = 0;
		particle.theParent = this;
		particle.physicsExcempt = true;
		particle.isDynamic = false;
		state = PORTAL_STATUS_CLOSED;
		clip.stop();
	}

	public function advance() : Array {
		var events : Array = new Array();
		thinkTime --;
		if (thinkTime <= 0) {
			switch (state) {
				case PORTAL_STATUS_OPEN : 
					if ( particle.position.subtract(theGame.entities[PlatformGame.PLAYER_INDEX].particle.position).getLength() < 100 ) {
						if ( clip.hitTest(theGame.entities[PlatformGame.PLAYER_INDEX].clip) ) {
							events.push(new Event(Event.TRIGGER_LEVEL_END, this, new Array()));
						} 
					}
					break;
				case PORTAL_STATUS_CLOSED :
					;
					break;
			}
			thinkTime = defaultThinkTime*2;	
		}
		return events;
	}
	
	public function act(e : Event) : Array {
		var events : Array = new Array();;
		
		switch (e.type) {
			case PORTAL_EVENT_OPEN :
			trace ( "PORTAL OPEN");
				if (state != PORTAL_STATUS_OPEN ) {
					clip.play();
					state = PORTAL_STATUS_OPEN;
				}
				break;
		}
		
		
		return events;	
	}
	
	public function remove() : Void {
		particle.gravityExcempt = true;
		this.isOnScreen = false;
		this.defaultThinkTime = 9999999;
		this.thinkTime = defaultThinkTime;
		state = GameEntity.GAME_ENTITY_STATE_DEFAULT;
		
		//delete(particle);
		clip.removeMovieClip();
	}
}
//eof