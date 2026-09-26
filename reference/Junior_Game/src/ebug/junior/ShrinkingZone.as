import ebug.Player;

class ebug.junior.ShrinkingZone extends MovieClip {
	public var loadedHarry : Boolean;
	public var loadedAmy : Boolean;
	
	public var harry : MovieClip;
	public var amy : MovieClip;
	
	public var userAvatar : MovieClip;
	
	private var mcLoader : MovieClipLoader;
	
	function ShrinkingZone() {		
		// flash wouldn't import shrinking zones - i think it is because of namespace violations with harry and amy
		// so I had to attach them at run time
		loadedHarry = false;
		loadedAmy = false;

		harry = createEmptyMovieClip("harry", getNextHighestDepth());
		amy = createEmptyMovieClip("amy", getNextHighestDepth());
		mcLoader = new MovieClipLoader();
		
		mcLoader.addListener(this);
		mcLoader.loadClip("shrinking_harry.swf", harry);
		mcLoader.loadClip("shrinking_amy.swf", amy);		
	}
	
	function onLoadInit(mc:MovieClip) {
		mc.callObj = this;
		mc.callFunc = "forceReassignAvatar";
	   if (mc._name == "harry") {
		   loadedHarry = true;
	   } else if (mc._name == "amy") {
			loadedAmy = true;   
	   }

	   if ( loadedHarry && loadedAmy ) {
			amy._visible = false;
			harry._visible = false;
	   }
	}
	
	function setUserAvatar(sex : Boolean) {
		if ( sex == Player.MALE ) {
//			trace ("setting avatar male");
			userAvatar = harry;
			
			//amy.unloadMovie();
		} else {
//			trace ("setting avatar female");
			userAvatar = amy;
			//harry.unloadMovie();
		}
	}
	
	function isFinishedAnimation() {
//		trace (" is finished? " + ( userAvatar.avatar.midAnimation  ) + " ["+userAvatar.avatar+"]");
		if ( userAvatar.avatar.midAnimation == false ) {
			userAvatar.avatar.gotoAndStop("start");
			//_parent.showHoverboard();
			_root.showHoverboardOrKitchen();
						
		}  else { 
			//trace ("user alpha: " + userAvatar.avatar._alpha);
			// the code below fades harry out but not amy - amy needs that hack in forcereassignavatar below
			/*
			if ( userAvatar.avatar._alpha >= 20 )
				userAvatar.avatar._alpha--;
			else userAvatar.avatar._alpha++;
			userAvatar.avatar._x--;
			*/
		}
	}
	
	/* there are multiple avatars kicking about and can't be sure which is the correct one so
	 * this function is a hacky way to fix - whichever one IS the avatar, call this function!
	 */
	function forceReassignAvatar( avatar : MovieClip ) {
		//trace ("found avatar" + avatar);
		userAvatar = avatar;
	}
}