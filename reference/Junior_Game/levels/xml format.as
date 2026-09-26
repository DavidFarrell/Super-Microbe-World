<?xml version="1.0"?>
<level cols="48" rows="14" next="level2.xml" name="new level">
	<tiles>
		<tile id="0">
			<movie>red_box</movie>
			<type>
				1
			</type>
			<sides>
				<left>1</left>
				<right>1</right>
				<top>1</top>
				<bottom>0</bottom>
			</sides>
			<rows>1</rows>
			<cols>1</cols>
			<entity>1</entity>
			<script></script>
		</tile>
		<tile id="1">
			<movie>avatar</movie>
			<type>
				0
			</type>
			<sides>
				<left>1</left>
				<right>1</right>
				<top>1</top>
				<bottom>1</bottom>
			</sides>
			<rows>2</rows>
			<cols>1</cols>
			<entity>1</entity>
			<script>GameEntities.Player</script>
		</tile>
	</tiles>
	<rows>
		<row id="0">
			<column id="0">
				<tile id="0" />
			</column>
			<column id="1">
				<tile id="1" />
			</column>
		</row>
	</rows>
</level>


